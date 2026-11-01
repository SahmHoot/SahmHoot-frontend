import { Client, ReconnectionTimeMode } from '@stomp/stompjs'
import type { IMessage, StompSubscription } from '@stomp/stompjs'

/**
 * 앱 전체에서 하나만 쓰는 STOMP 연결(06 실시간 규격 1절).
 *
 * - 탭마다 연결 1개. connectStomp()를 여러 번 불러도 새 연결을 만들지 않는다
 * - 끊기면 1·2·4·8초 … 최대 30초 간격으로 재연결하고, 등록된 구독을 모두 복원한다
 * - 토큰이 없거나 만료됐거나 서버가 CONNECT를 거부(UNAUTHORIZED)하면 재연결을 멈춘다
 * - 컴포넌트 unmount에서 끊지 않는다. 로그아웃 때만 disconnectStomp()
 */

export type StompStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unauthorized'

/** 서버 → 클라이언트 ERROR 메시지(/user/queue/errors, 06 4절). */
export interface StompErrorMessage {
  type: 'ERROR'
  sentAt: string
  code: string
  message: string
}

export interface StompConfig {
  /** 연결을 시도할 때마다 불러 최신 토큰을 받는다. 없으면 null. */
  getToken: () => string | null
  /** 인증 실패로 재연결을 멈췄을 때. 보통 토큰을 지우고 로그인 화면으로 보낸다. */
  onUnauthorized?: () => void
  /** 기본값은 현재 주소의 /ws(개발 서버는 vite 프록시가 백엔드로 넘긴다). */
  brokerURL?: string
  debug?: boolean
}

type MessageHandler = (body: unknown, message: IMessage) => void

interface Registration {
  destination: string
  handler: MessageHandler
  subscription?: StompSubscription
}

const ERRORS_DESTINATION = '/user/queue/errors'
const RECONNECT_DELAY_MS = 1_000
const MAX_RECONNECT_DELAY_MS = 30_000
const HEARTBEAT_MS = 10_000
/** CONNECTED가 이 시간 안에 오지 않으면 끊고 재시도한다. */
const CONNECTION_TIMEOUT_MS = 10_000

let config: StompConfig | null = null
let client: Client | null = null
let status: StompStatus = 'idle'
let nextId = 0

const registrations = new Map<number, Registration>()
const statusListeners = new Set<(status: StompStatus) => void>()
const connectedListeners = new Set<() => void>()
const errorListeners = new Set<(error: StompErrorMessage) => void>()

export function configureStomp(next: StompConfig): void {
  config = next
}

/** 연결을 시작한다. 이미 연결 중이거나 연결돼 있으면 아무것도 하지 않는다. */
export function connectStomp(): void {
  if (!config) {
    throw new Error('configureStomp()를 먼저 호출해야 합니다.')
  }
  if (client?.active) {
    return
  }
  client = createClient(config)
  setStatus('connecting')
  client.activate()
}

/** 로그아웃용. 연결을 끊고 등록된 구독도 모두 지운다. */
export async function disconnectStomp(): Promise<void> {
  const current = client
  client = null
  registrations.clear()
  setStatus('idle')
  await current?.deactivate()
}

/**
 * 목적지를 구독한다. 재연결하면 자동으로 다시 구독한다.
 * 돌려받은 함수를 부르면 구독을 해제한다.
 */
export function subscribe(destination: string, handler: MessageHandler): () => void {
  const id = nextId++
  const registration: Registration = { destination, handler }
  registrations.set(id, registration)
  if (client?.connected) {
    attach(client, registration)
  }
  return () => {
    registrations.delete(id)
    if (client?.connected) {
      registration.subscription?.unsubscribe()
    }
    registration.subscription = undefined
  }
}

/**
 * 메시지를 보낸다. 연결돼 있지 않으면 보내지 않고 false.
 * 끊긴 동안 쌓아 두었다가 늦게 보내지 않는다(이미 마감된 문항에 답이 들어가는 일을 막는다).
 */
export function publish(destination: string, body: unknown): boolean {
  if (!client?.connected) {
    return false
  }
  client.publish({ destination, body: JSON.stringify(body) })
  return true
}

export function getStompStatus(): StompStatus {
  return status
}

export function onStompStatus(listener: (status: StompStatus) => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

/**
 * 연결(재연결 포함)되고 구독 복원이 끝날 때마다 불린다.
 * 06 1절 4번: 여기서 GET /api/rooms/{roomId}/state로 스냅샷을 다시 받는다.
 */
export function onStompConnected(listener: () => void): () => void {
  connectedListeners.add(listener)
  return () => connectedListeners.delete(listener)
}

/** 내가 보낸 요청이 거부됐을 때(RATE_LIMITED, FORBIDDEN 등). */
export function onStompErrorMessage(listener: (error: StompErrorMessage) => void): () => void {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

function createClient(cfg: StompConfig): Client {
  const log = cfg.debug ? (text: string) => console.debug('[stomp]', text) : () => {}
  const next = new Client({
    brokerURL: cfg.brokerURL ?? defaultBrokerURL(),
    reconnectDelay: RECONNECT_DELAY_MS,
    maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    heartbeatIncoming: HEARTBEAT_MS,
    heartbeatOutgoing: HEARTBEAT_MS,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    debug: log,
  })

  // 시도할 때마다 최신 토큰을 넣는다. 없거나 만료됐으면 서버에 가지 않고 멈춘다.
  next.beforeConnect = async () => {
    const token = cfg.getToken()
    if (!token || isExpired(token)) {
      await stopUnauthorized(next)
      return
    }
    next.connectHeaders = { Authorization: `Bearer ${token}` }
  }

  next.onConnect = () => {
    if (client !== next) {
      return
    }
    // 오류 큐를 먼저 구독해야 뒤이은 구독의 거부 알림을 받는다.
    next.subscribe(ERRORS_DESTINATION, (message) => {
      const error = parse(message) as StompErrorMessage
      log(`ERROR ${error.code}: ${error.message}`)
      errorListeners.forEach((listener) => listener(error))
    })
    registrations.forEach((registration) => attach(next, registration))
    setStatus('connected')
    connectedListeners.forEach((listener) => listener())
  }

  next.onStompError = (frame) => {
    if (frame.headers.message === 'UNAUTHORIZED') {
      void stopUnauthorized(next)
    }
  }

  next.onWebSocketClose = () => {
    // 이전 연결의 구독 객체는 더 이상 쓸 수 없다. 재연결하면 onConnect에서 새로 만든다.
    registrations.forEach((registration) => {
      registration.subscription = undefined
    })
    if (client === next && next.active && status !== 'unauthorized') {
      setStatus('reconnecting')
    }
  }

  return next
}

function attach(target: Client, registration: Registration): void {
  registration.subscription = target.subscribe(registration.destination, (message) =>
    registration.handler(parse(message), message),
  )
}

async function stopUnauthorized(target: Client): Promise<void> {
  if (client !== target) {
    return
  }
  setStatus('unauthorized')
  await target.deactivate()
  config?.onUnauthorized?.()
}

function setStatus(next: StompStatus): void {
  if (status === next) {
    return
  }
  status = next
  statusListeners.forEach((listener) => listener(next))
}

function parse(message: IMessage): unknown {
  try {
    return JSON.parse(message.body)
  } catch {
    return message.body
  }
}

function defaultBrokerURL(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${window.location.host}/ws`
}

/** 서명은 서버가 검사한다. 여기서는 만료된 토큰으로 헛되이 연결하지 않으려고 exp만 본다. */
function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 <= Date.now()
  } catch {
    return false
  }
}
