import { afterEach, describe, expect, it, vi } from 'vitest'
import { roomDestinations, startRoomSync } from './roomSync'
import type { RoomSyncDeps } from './roomSync'
import type { RoomChannel, RoomRealtimeMessage } from './roomSyncFilter'
import type { StompStatus } from './stompClient'
import type { RoomStateQuiz, RoomStateResponse } from '../types/roomState'

const ROOM_ID = 7
/** 스냅샷 시각. 서버는 마이크로초까지 보낸다. */
const T0 = '2026-11-08T10:00:00.000500Z'
const BEFORE = '2026-11-08T09:59:59.000000Z'
const AFTER = '2026-11-08T10:00:01.000000Z'
const LATER = '2026-11-08T10:00:02.000000Z'

interface Load {
  resolve: (state: RoomStateResponse) => void
  reject: (error: unknown) => void
  signal: AbortSignal
}

/** 가짜 STOMP 연결과 가짜 state API로 동기화 모듈을 띄운다. */
/** autoReceipt: 연결돼 있으면 서버가 구독마다 바로 RECEIPT를 보낸 것처럼 한다. */
function setup({ owner = false, connected = true, autoReceipt = true } = {}) {
  const handlers = new Map<string, (body: unknown) => void>()
  const readies = new Map<string, () => void>()
  const connectedListeners = new Set<() => void>()
  const statusListeners = new Set<(status: StompStatus) => void>()
  const loads: Load[] = []
  /** 화면이 받은 순서. 스냅샷이 메시지보다 먼저 적용됐는지 확인한다. */
  const log: string[] = []
  const messages: [RoomChannel, RoomRealtimeMessage][] = []
  const errors: unknown[] = []

  const deps: RoomSyncDeps = {
    subscribe: (destination, handler, onReady) => {
      handlers.set(destination, handler)
      readies.set(destination, onReady)
      if (autoReceipt && connected) {
        onReady()
      }
      return () => {
        handlers.delete(destination)
        readies.delete(destination)
      }
    },
    onConnected: (listener) => {
      connectedListeners.add(listener)
      return () => connectedListeners.delete(listener)
    },
    onStatus: (listener) => {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    isConnected: () => connected,
    loadState: (_roomId, signal) =>
      new Promise((resolve, reject) => loads.push({ resolve, reject, signal })),
    isRetryable: (error) => error === 'network',
  }

  const stop = startRoomSync(
    {
      roomId: ROOM_ID,
      owner,
      onSnapshot: (state) => log.push(`snapshot:${state.serverTime}`),
      onMessage: (channel, message) => {
        messages.push([channel, message])
        log.push(`${channel}:${message.type}`)
      },
      onSyncError: (error) => errors.push(error),
    },
    deps,
  )

  const destination = (channel: RoomChannel) =>
    roomDestinations(ROOM_ID, true).find(([name]) => name === channel)![1]

  return {
    loads,
    log,
    messages,
    errors,
    handlers,
    stop,
    send(channel: RoomChannel, body: RoomRealtimeMessage) {
      handlers.get(destination(channel))?.(body)
    },
    /** 연결이 끊겼다가 다시 붙는다. shared/stomp처럼 구독 복원 뒤 연결 리스너를 부른다. */
    reconnect() {
      statusListeners.forEach((listener) => listener('reconnecting'))
      statusListeners.forEach((listener) => listener('connected'))
      if (autoReceipt) {
        readies.forEach((onReady) => onReady())
      }
      connectedListeners.forEach((listener) => listener())
    },
    /** 서버가 해당 구독의 RECEIPT를 보낸다. */
    receipt(channel: RoomChannel) {
      readies.get(destination(channel))?.()
    },
    types: () => messages.map(([, message]) => message.type),
  }
}

/** loadState의 then 콜백이 실행되도록 마이크로태스크를 비운다. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

function roomState(overrides: Partial<RoomStateResponse> = {}): RoomStateResponse {
  return {
    serverTime: T0,
    room: { id: ROOM_ID, title: '자료구조', status: 'OPEN', joinCode: 'ABC123', joinUrl: '', ownerName: '교수' },
    quizRun: null,
    me: { participantId: 1, nickname: '학생', isOwner: false, chatBlocked: false },
    onlineCount: 3,
    quiz: null,
    pinnedMessage: null,
    recentMessages: [],
    ...overrides,
  }
}

function quizAt(phase: RoomStateQuiz['phase'], questionNo: number, runQuestionId: number, runId = 77): RoomStateQuiz {
  return {
    runId,
    questionSetTitle: '스택',
    totalQuestions: 5,
    phase,
    currentQuestion:
      phase === 'RESULT'
        ? null
        : {
            runQuestionId,
            questionNo,
            questionType: 'MULTIPLE_CHOICE',
            timeLimitSeconds: 15,
            content: '문항',
            choices: [],
            openedAt: BEFORE,
            closesAt: AFTER,
            closedAt: phase === 'FEEDBACK' ? T0 : null,
            correctChoiceId: null,
          },
    nextOpensAt: null,
    result: phase === 'RESULT' ? { questions: [] } : null,
  }
}

const opened = (questionNo: number, runQuestionId: number, sentAt: string, runId = 77) => ({
  type: 'QUESTION_OPENED',
  sentAt,
  runId,
  runQuestionId,
  questionNo,
  totalQuestions: 5,
})
const closed = (runQuestionId: number, sentAt: string, runId = 77) => ({
  type: 'QUESTION_CLOSED',
  sentAt,
  runId,
  runQuestionId,
  correctChoiceId: 1,
  isLast: false,
})
const chat = (id: number, sentAt: string) => ({ type: 'MESSAGE', sentAt, id, content: `채팅 ${id}` })
const chatMessage = (id: number) => ({
  id,
  senderParticipantId: 1,
  nickname: '학생',
  isOwner: false,
  content: `채팅 ${id}`,
  parentId: null,
  parentPreview: null,
  createdAt: BEFORE,
})
const online = (onlineCount: number, sentAt: string) => ({ type: 'ONLINE_COUNT', sentAt, onlineCount })

afterEach(() => {
  vi.useRealTimers()
})

describe('startRoomSync', () => {
  it('state 조회 중 도착한 문항 이벤트를 스냅샷 뒤에 반영하고, 스냅샷에 이미 있는 것은 버린다', async () => {
    const room = setup()
    expect(room.loads).toHaveLength(1)

    // 조회하는 동안 1번 열림(스냅샷에 이미 있음), 1번 마감, 2번 열림이 도착한다.
    room.send('quiz', opened(1, 801, BEFORE))
    room.send('quiz', closed(801, AFTER))
    room.send('quiz', opened(2, 802, LATER))
    expect(room.log).toEqual([])

    room.loads[0].resolve(roomState({ quiz: quizAt('QUESTION', 1, 801) }))
    await settle()

    // 스냅샷이 먼저, 그 뒤 새 이벤트만 도착 순서대로. 스냅샷이 2번 문항을 1번으로 되돌리지 않는다.
    expect(room.log).toEqual([`snapshot:${T0}`, 'quiz:QUESTION_CLOSED', 'quiz:QUESTION_OPENED'])

    // 같은 2번 열림이 늦게 한 번 더 와도 버린다.
    room.send('quiz', opened(2, 802, LATER))
    expect(room.types()).toEqual(['QUESTION_CLOSED', 'QUESTION_OPENED'])
  })

  it('재연결 후 같은 채팅이 두 번 전달되지 않는다', async () => {
    const room = setup()
    room.loads[0].resolve(roomState({ recentMessages: [chatMessage(1), chatMessage(2)] }))
    await settle()

    room.send('chat', chat(2, BEFORE))
    room.send('chat', chat(3, AFTER))
    expect(room.types()).toEqual(['MESSAGE'])

    // 재연결: 다시 조회하는 동안 3번(새 스냅샷에도 있음)과 4번이 도착한다.
    room.reconnect()
    expect(room.loads).toHaveLength(2)
    room.send('chat', chat(3, AFTER))
    room.send('chat', chat(4, LATER))
    room.loads[1].resolve(
      roomState({ serverTime: AFTER, recentMessages: [chatMessage(1), chatMessage(2), chatMessage(3)] }),
    )
    await settle()
    room.send('chat', chat(4, LATER))

    expect(room.messages.map(([, message]) => message.id)).toEqual([3, 4])
  })

  it('스냅샷보다 오래된 집계 메시지는 인원 수를 되돌리지 않는다', async () => {
    const room = setup()
    // 스냅샷과 같은 밀리초 안이지만 마이크로초가 이르다.
    room.send('presence', online(2, '2026-11-08T10:00:00.000400Z'))
    room.loads[0].resolve(roomState({ onlineCount: 3 }))
    await settle()
    expect(room.messages).toEqual([])

    room.send('presence', online(4, '2026-11-08T10:00:00.000600Z'))
    // 앞의 메시지보다 늦게 도착했지만 더 이전 값이다.
    room.send('presence', online(1, '2026-11-08T10:00:00.000550Z'))
    expect(room.messages.map(([, message]) => message.onlineCount)).toEqual([4])
  })

  it('이전 연결의 늦은 state 응답은 무시하고 마지막 조회만 반영한다', async () => {
    const room = setup()
    room.reconnect()
    expect(room.loads[0].signal.aborted).toBe(true)

    room.loads[0].resolve(roomState({ serverTime: BEFORE }))
    room.loads[1].resolve(roomState({ serverTime: AFTER }))
    await settle()
    expect(room.log).toEqual([`snapshot:${AFTER}`])
  })

  it('조회 실패는 간격을 늘려 다시 시도하고, 다시 해도 소용없는 실패는 알린 뒤 멈춘다', async () => {
    vi.useFakeTimers()
    const room = setup()
    room.loads[0].reject('network')
    await settle()
    vi.advanceTimersByTime(999)
    expect(room.loads).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(room.loads).toHaveLength(2)

    room.loads[1].reject('network')
    await settle()
    vi.advanceTimersByTime(2_000)
    expect(room.loads).toHaveLength(3)

    room.loads[2].reject('ROOM_CLOSED')
    await settle()
    expect(room.errors).toEqual(['ROOM_CLOSED'])
    room.reconnect()
    room.send('presence', online(5, LATER))
    expect(room.loads).toHaveLength(3)
    expect(room.messages).toEqual([])
  })

  it('대기 스냅샷 뒤에 도착한 이전 회차 메시지는 버리고 새 회차는 반영한다', async () => {
    const room = setup()
    room.send('quiz', { type: 'QUIZ_FINISHED', sentAt: BEFORE, runId: 76, result: { questions: [] } })
    room.send('quiz', { type: 'ROOM_WAITING', sentAt: BEFORE })
    room.send('quiz', opened(1, 901, AFTER, 78))
    room.loads[0].resolve(roomState())
    await settle()
    expect(room.types()).toEqual(['QUESTION_OPENED'])
  })

  it('결과 스냅샷 뒤에 도착한 이전 회차의 ROOM_WAITING은 결과 화면을 덮지 않는다', async () => {
    const room = setup()
    room.send('quiz', { type: 'ROOM_WAITING', sentAt: BEFORE })
    room.loads[0].resolve(roomState({ quiz: quizAt('RESULT', 0, 0) }))
    await settle()
    room.send('quiz', { type: 'QUIZ_FINISHED', sentAt: BEFORE, runId: 77, result: { questions: [] } })
    expect(room.messages).toEqual([])

    room.send('quiz', { type: 'ROOM_WAITING', sentAt: AFTER })
    expect(room.types()).toEqual(['ROOM_WAITING'])
  })

  it('열림을 받지 못한 문항의 마감이 오면 스냅샷을 다시 받는다', async () => {
    const room = setup()
    room.loads[0].resolve(roomState({ quiz: quizAt('QUESTION', 1, 801) }))
    await settle()

    room.send('quiz', closed(802, LATER))
    expect(room.messages).toEqual([])
    expect(room.loads).toHaveLength(2)
  })

  it('소유자만 stats 큐를 구독하고, 지금 열린 문항의 응답 현황만 넘긴다', async () => {
    expect(setup().handlers.has(`/user/queue/rooms/${ROOM_ID}/stats`)).toBe(false)

    const room = setup({ owner: true })
    room.loads[0].resolve(roomState({ quiz: quizAt('QUESTION', 2, 802) }))
    await settle()
    room.send('stats', { type: 'ANSWER_PROGRESS', sentAt: AFTER, runQuestionId: 801, answeredCount: 9 })
    room.send('stats', { type: 'ANSWER_PROGRESS', sentAt: AFTER, runQuestionId: 802, answeredCount: 4 })
    expect(room.messages.map(([, message]) => message.answeredCount)).toEqual([4])
  })

  it('구독 RECEIPT를 모두 받은 뒤에 state를 조회하고, 그동안 온 메시지는 스냅샷 뒤에 반영한다', async () => {
    const room = setup({ autoReceipt: false })
    room.send('presence', online(5, AFTER))
    room.receipt('quiz')
    room.receipt('chat')
    room.receipt('reaction')
    room.receipt('presence')
    expect(room.loads).toHaveLength(0)

    room.receipt('me')
    expect(room.loads).toHaveLength(1)
    room.loads[0].resolve(roomState())
    await settle()
    expect(room.log).toEqual([`snapshot:${T0}`, 'presence:ONLINE_COUNT'])
  })

  it('RECEIPT가 오지 않으면 제한시간 뒤에 조회하고, 그 뒤 재연결에서는 기다리지 않는다', async () => {
    vi.useFakeTimers()
    const room = setup({ autoReceipt: false })
    vi.advanceTimersByTime(2_999)
    expect(room.loads).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(room.loads).toHaveLength(1)

    room.loads[0].resolve(roomState())
    await settle()
    room.reconnect()
    expect(room.loads).toHaveLength(2)
  })

  it('RECEIPT가 늦게 도착하면 다시 조회해 복구하고, 다음 재연결에서는 다시 RECEIPT를 기다린다', async () => {
    vi.useFakeTimers()
    const room = setup({ autoReceipt: false })
    vi.advanceTimersByTime(3_000)
    expect(room.loads).toHaveLength(1)
    room.loads[0].resolve(roomState())
    await settle()

    // 제한시간 뒤에 RECEIPT가 모두 도착: 확인 없이 조회한 스냅샷을 믿지 않고 다시 조회한다.
    for (const channel of ['quiz', 'chat', 'reaction', 'presence', 'me'] as const) {
      room.receipt(channel)
    }
    expect(room.loads).toHaveLength(2)

    // 다음 재연결에서는 RECEIPT를 다시 기다린다.
    room.reconnect()
    expect(room.loads).toHaveLength(2)
    room.receipt('quiz')
    room.receipt('chat')
    room.receipt('reaction')
    room.receipt('presence')
    room.receipt('me')
    expect(room.loads).toHaveLength(3)
  })

  it('연결 전에 시작하면 연결된 뒤에 조회하고, 정리하면 구독을 해제한다', async () => {
    const room = setup({ connected: false })
    expect(room.loads).toHaveLength(0)
    expect(room.handlers.size).toBe(5)

    room.reconnect()
    expect(room.loads).toHaveLength(1)

    room.stop()
    expect(room.loads[0].signal.aborted).toBe(true)
    expect(room.handlers.size).toBe(0)
    room.loads[0].resolve(roomState())
    await settle()
    expect(room.log).toEqual([])
  })
})
