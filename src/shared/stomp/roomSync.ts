import { isAxiosError } from 'axios'
import { fetchRoomState } from '../api/roomState'
import type { RoomStateResponse } from '../types/roomState'
import { getStompStatus, onStompConnected, onStompStatus, subscribe } from './stompClient'
import type { StompStatus } from './stompClient'
import { createSnapshotFilter } from './roomSyncFilter'
import type { RoomChannel, RoomRealtimeMessage } from './roomSyncFilter'

/**
 * 방 화면의 '구독 → state → 버퍼' 절차(06 1절 연결 절차).
 *
 * 1. 방 채널을 모두 구독한다(소유자면 stats 큐 포함)
 * 2. 연결될 때마다(재연결 포함) 서버가 모든 구독을 등록했다는 RECEIPT를 받은 뒤 GET /api/rooms/{roomId}/state로
 *    스냅샷을 받는다. 구독을 보낸 뒤부터 스냅샷을 넘길 때까지 온 메시지는 버퍼에 둔다
 * 3. 스냅샷을 onSnapshot으로 넘긴 뒤, 버퍼를 도착 순서대로 걸러서 onMessage로 넘긴다
 * 4. 이후 메시지도 같은 기준으로 걸러서 넘긴다. 거르는 규칙은 roomSyncFilter.ts
 *
 * 화면은 onSnapshot으로 상태를 통째로 바꾸고, onMessage로만 갱신한다. 이 모듈 밖에서 같은 방 채널을 따로 구독하지 않는다.
 *
 * RECEIPT를 기다리는 이유: 등록 전에 조회하면 그 사이 발행된 메시지(ROOM_WAITING 등)가 스냅샷에도 버퍼에도 없다.
 * 서버가 RECEIPT를 보내지 않으면(백엔드 #64 이전) 제한시간 뒤에 조회하고, 그 뒤로는 기다리지 않는다.
 * 그때 놓친 퀴즈 메시지는 모르는 문항의 마감이 오면 다시 조회해 복구하고, 집계는 다음 메시지가 바로잡는다.
 */

export interface RoomSyncOptions {
  roomId: number
  /** 방 소유자면 stats 큐(ANSWER_PROGRESS, REACTION_STATS)도 구독한다. 소유자가 아니면 서버가 구독을 거부한다. */
  owner: boolean
  /** 스냅샷을 받을 때마다(처음 연결, 재연결, 누락 감지) 불린다. 화면 상태를 이 값으로 교체한다. */
  onSnapshot: (state: RoomStateResponse) => void
  /** 걸러진 메시지를 도착 순서대로 받는다. 모르는 type은 화면에서 무시한다. */
  onMessage: (channel: RoomChannel, message: RoomRealtimeMessage) => void
  /** 다시 시도해도 소용없는 조회 실패(방 종료, 참여자 아님 등). 이후 동기화를 멈춘다. */
  onSyncError?: (error: unknown) => void
}

/** 테스트에서 STOMP 연결과 API를 가짜로 바꾸려고 둔 의존성. */
export interface RoomSyncDeps {
  subscribe: (destination: string, handler: (body: unknown) => void, onReady: () => void) => () => void
  onConnected: (listener: () => void) => () => void
  onStatus: (listener: (status: StompStatus) => void) => () => void
  isConnected: () => boolean
  loadState: (roomId: number, signal: AbortSignal) => Promise<RoomStateResponse>
  isRetryable: (error: unknown) => boolean
}

const defaultDeps: RoomSyncDeps = {
  subscribe,
  onConnected: onStompConnected,
  onStatus: onStompStatus,
  isConnected: () => getStompStatus() === 'connected',
  loadState: fetchRoomState,
  isRetryable: isRetryableError,
}

/** 조회가 오래 걸려 버퍼가 이만큼 쌓이면 지금 조회를 버리고 새로 조회한다. */
const MAX_BUFFERED_MESSAGES = 1_000
const RETRY_DELAY_MS = 1_000
/** 구독 RECEIPT를 기다리는 최대 시간. 넘으면 그냥 조회한다. */
const RECEIPT_TIMEOUT_MS = 3_000
const MAX_RETRY_DELAY_MS = 30_000

export function roomDestinations(roomId: number, owner: boolean): [RoomChannel, string][] {
  const destinations: [RoomChannel, string][] = [
    ['quiz', `/topic/rooms/${roomId}/quiz`],
    ['chat', `/topic/rooms/${roomId}/chat`],
    ['reaction', `/topic/rooms/${roomId}/reaction`],
    ['presence', `/topic/rooms/${roomId}/presence`],
    ['me', `/user/queue/rooms/${roomId}/me`],
  ]
  if (owner) {
    destinations.push(['stats', `/user/queue/rooms/${roomId}/stats`])
  }
  return destinations
}

/** 동기화를 시작한다. 돌려받은 함수를 부르면 구독을 해제하고 진행 중인 조회를 취소한다. */
export function startRoomSync(options: RoomSyncOptions, deps: RoomSyncDeps = defaultDeps): () => void {
  const { roomId, owner, onSnapshot, onMessage, onSyncError } = options
  /** 조회할 때마다 1씩 올린다. 이전 조회의 늦은 응답·재시도 타이머는 번호가 달라 무시된다. */
  let generation = 0
  let mode: 'buffering' | 'live' | 'stopped' = 'buffering'
  let buffer: [RoomChannel, RoomRealtimeMessage][] = []
  let filter: ReturnType<typeof createSnapshotFilter> | null = null
  let pending: AbortController | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let receiptTimer: ReturnType<typeof setTimeout> | null = null
  /** 이번 연결에서 서버가 등록을 확인한 채널. 끊기면 비운다. */
  const ready = new Set<RoomChannel>()
  /** RECEIPT를 하나도 받지 못하고 제한시간이 지나면 서버가 지원하지 않는 것으로 보고 기다리지 않는다. RECEIPT가 오면 되돌린다. */
  let receiptsUnsupported = false
  /** 이번 연결에서 구독 확인 없이 조회했다. 늦게라도 모든 RECEIPT가 오면 그사이 놓친 메시지를 복구하려고 다시 조회한다. */
  let loadedUnconfirmed = false
  let closed = false
  const destinations = roomDestinations(roomId, owner)
  const allReady = () => destinations.every(([channel]) => ready.has(channel))

  function cancelLoading(): void {
    generation += 1
    pending?.abort()
    pending = null
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    if (receiptTimer !== null) {
      clearTimeout(receiptTimer)
      receiptTimer = null
    }
  }

  function resync(): void {
    if (closed || mode === 'stopped') {
      return
    }
    cancelLoading()
    mode = 'buffering'
    buffer = []
    if (allReady()) {
      loadedUnconfirmed = false
      load(generation, 0)
      return
    }
    if (receiptsUnsupported) {
      loadedUnconfirmed = true
      load(generation, 0)
      return
    }
    const current = generation
    receiptTimer = setTimeout(() => {
      receiptTimer = null
      if (current !== generation) {
        return
      }
      if (ready.size === 0) {
        receiptsUnsupported = true
      }
      loadedUnconfirmed = true
      load(current, 0)
    }, RECEIPT_TIMEOUT_MS)
  }

  function markReady(channel: RoomChannel): void {
    ready.add(channel)
    receiptsUnsupported = false
    if (!allReady()) {
      return
    }
    if (receiptTimer !== null) {
      // RECEIPT를 기다리던 중이면 마지막 RECEIPT에서 조회를 시작한다.
      clearTimeout(receiptTimer)
      receiptTimer = null
      load(generation, 0)
    } else if (loadedUnconfirmed) {
      loadedUnconfirmed = false
      resync()
    }
  }

  function load(current: number, attempt: number): void {
    const controller = new AbortController()
    pending = controller
    deps.loadState(roomId, controller.signal).then(
      (state) => {
        if (current !== generation) {
          return
        }
        pending = null
        filter = createSnapshotFilter(state)
        onSnapshot(state)
        const queued = buffer
        buffer = []
        mode = 'live'
        for (const [channel, message] of queued) {
          // 처리 중에 누락을 감지해 다시 조회하거나 정리되면 나머지는 새 스냅샷이 대신한다.
          if (current !== generation) {
            return
          }
          deliver(channel, message)
        }
      },
      (error: unknown) => {
        if (current !== generation) {
          return
        }
        pending = null
        if (!deps.isRetryable(error)) {
          mode = 'stopped'
          buffer = []
          onSyncError?.(error)
          return
        }
        const delay = Math.min(RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS)
        retryTimer = setTimeout(() => {
          retryTimer = null
          if (current === generation) {
            load(current, attempt + 1)
          }
        }, delay)
      },
    )
  }

  function deliver(channel: RoomChannel, message: RoomRealtimeMessage): void {
    if (closed || !filter) {
      return
    }
    const verdict = filter.accept(channel, message)
    if (verdict === 'resync') {
      resync()
    } else if (verdict === 'apply') {
      onMessage(channel, message)
    }
  }

  function receive(channel: RoomChannel) {
    return (body: unknown) => {
      const message = toRealtimeMessage(body)
      if (closed || mode === 'stopped' || !message) {
        return
      }
      // 수업 종료는 조회 중에도 즉시 알리고, 늦은 스냅샷과 재시도로 되살리지 않는다.
      if (channel === 'quiz' && message.type === 'ROOM_ENDED') {
        cancelLoading()
        mode = 'stopped'
        buffer = []
        onMessage(channel, message)
        return
      }
      if (mode === 'live') {
        deliver(channel, message)
        return
      }
      buffer.push([channel, message])
      if (buffer.length > MAX_BUFFERED_MESSAGES) {
        resync()
      }
    }
  }

  const unsubscribes = destinations.map(([channel, destination]) =>
    deps.subscribe(destination, receive(channel), () => markReady(channel)),
  )
  // shared/stomp는 재연결하면 등록된 구독을 먼저 복원한 뒤 연결 리스너를 부른다.
  const removeConnected = deps.onConnected(resync)
  const removeStatus = deps.onStatus((status) => {
    // 끊긴 동안의 조회 결과는 쓰지 않는다. 다시 연결되면 처음부터 조회한다.
    if (status !== 'connected') {
      ready.clear()
      loadedUnconfirmed = false
    }
    if (status !== 'connected' && mode !== 'stopped') {
      cancelLoading()
      mode = 'buffering'
      buffer = []
    }
  })
  if (deps.isConnected()) {
    resync()
  }

  return () => {
    closed = true
    cancelLoading()
    buffer = []
    unsubscribes.forEach((unsubscribe) => unsubscribe())
    removeConnected()
    removeStatus()
  }
}

function toRealtimeMessage(body: unknown): RoomRealtimeMessage | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const { type, sentAt } = body as { type?: unknown; sentAt?: unknown }
  return typeof type === 'string' && typeof sentAt === 'string' ? (body as RoomRealtimeMessage) : null
}

/** 응답이 없거나(연결 실패·제한시간) 서버 오류(5xx)면 다시 시도한다. 4xx는 다시 해도 같으므로 멈춘다. */
function isRetryableError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false
  }
  const status = error.response?.status
  return status === undefined || status >= 500
}
