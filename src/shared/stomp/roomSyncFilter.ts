import type { RoomStateResponse } from '../types/roomState'

/** 방 채널. 목적지는 roomSync.ts의 roomDestinations()에 있다(06 2절). */
export type RoomChannel = 'quiz' | 'chat' | 'reaction' | 'presence' | 'me' | 'stats'

/** 서버 → 클라이언트 메시지의 공통 필드(06 4절). 나머지 필드는 type마다 다르다. */
export interface RoomRealtimeMessage {
  type: string
  sentAt: string
  [field: string]: unknown
}

/** apply: 화면에 넘긴다 / drop: 이미 반영된 메시지라 버린다 / resync: 놓친 메시지가 있어 스냅샷을 다시 받는다 */
export type FilterVerdict = 'apply' | 'drop' | 'resync'

/** 전체 값을 담는 메시지. 늦게 도착한 이전 값이 최신 값을 되돌리지 않도록 sentAt으로 거른다. */
const LATEST_VALUE_TYPES = new Set(['ONLINE_COUNT', 'ANSWER_PROGRESS', 'REACTION_STATS', 'MY_STATUS'])
const NOTICE_TYPES = new Set(['NOTICE_PINNED', 'NOTICE_UNPINNED'])

/** 퀴즈 진행 단계. 문항 n의 열림 = 2n-1, 마감 = 2n, 그 뒤 결과, 대기 순서다. */
const RESULT_STEP = Number.MAX_SAFE_INTEGER - 1
const WAITING_STEP = Number.MAX_SAFE_INTEGER

/**
 * 스냅샷 한 장을 기준으로 이후 메시지를 거른다(06 1절). 재연결해 스냅샷을 다시 받으면 새로 만든다.
 *
 * - 집계(ONLINE_COUNT·ANSWER_PROGRESS·REACTION_STATS)와 MY_STATUS: sentAt이 스냅샷 시각이나
 *   마지막으로 넘긴 같은 type의 sentAt보다 늦지 않으면 버린다. ANSWER_PROGRESS는 지금 열린 문항 것만 넘긴다.
 * - 채팅 MESSAGE: id로 중복을 없앤다. 공지 고정·해제는 집계처럼 sentAt으로 거른다.
 * - 퀴즈: runId·runQuestionId와 진행 순서로 이미 반영한 것을 버린다. 순서로 판단할 수 없는 경우
 *   (대기 스냅샷 뒤의 첫 메시지, runId가 없는 ROOM_WAITING, 모르는 문항의 마감)에만 sentAt을 쓴다.
 *   서버는 상태 조회와 퀴즈 상태 변경을 같은 방 잠금 안에서 처리하므로, 스냅샷에 반영된 변경의
 *   sentAt은 serverTime보다 이르다.
 * - 스냅샷 이후에 온 마감인데 그 문항이 열린 것을 본 적이 없으면 중간 메시지를 놓친 것이므로 resync를 돌려준다.
 */
export function createSnapshotFilter(state: RoomStateResponse) {
  const snapshotTime = instantNanos(state.serverTime)
  const latestSentAt = new Map<string, bigint>()
  const seenMessageIds = new Set<number>(state.recentMessages.map((message) => message.id))
  if (state.pinnedMessage) {
    seenMessageIds.add(state.pinnedMessage.id)
  }
  let noticeSentAt = snapshotTime

  const quiz = state.quiz
  let runId: number | null = quiz ? quiz.runId : null
  let step = quiz ? snapshotStep(quiz.phase, quiz.currentQuestion?.questionNo) : WAITING_STEP
  /** 지금 열려 있는 문항. 마감·결과·대기가 되면 null. */
  let openQuestionId: number | null =
    quiz?.phase === 'QUESTION' ? (quiz.currentQuestion?.runQuestionId ?? null) : null
  /** runQuestionId → questionNo. QUESTION_CLOSED에는 문항 번호가 없어서 열림 메시지로 채운다. */
  const questionNos = new Map<number, number>()
  if (quiz?.currentQuestion) {
    questionNos.set(quiz.currentQuestion.runQuestionId, quiz.currentQuestion.questionNo)
  }

  /** 스냅샷 이전에 만들어진 메시지인가. sentAt을 읽지 못하면 이전 것으로 보지 않는다. */
  const beforeSnapshot = (message: RoomRealtimeMessage): boolean => {
    const sentAt = instantNanos(message.sentAt)
    return sentAt !== null && snapshotTime !== null && sentAt <= snapshotTime
  }

  /** after보다 늦은 메시지만 통과시킨다. sentAt을 읽지 못하면 통과시킨다. */
  const newerThan = (message: RoomRealtimeMessage, after: bigint | null): bigint | null | false => {
    const sentAt = instantNanos(message.sentAt)
    if (sentAt === null || after === null) {
      return sentAt
    }
    return sentAt > after ? sentAt : false
  }

  function acceptQuiz(message: RoomRealtimeMessage): FilterVerdict {
    if (message.type === 'ROOM_ENDED') {
      return 'apply'
    }
    if (message.type === 'ROOM_WAITING') {
      if (beforeSnapshot(message) || step === WAITING_STEP) {
        return 'drop'
      }
      step = WAITING_STEP
      openQuestionId = null
      return 'apply'
    }
    const messageRunId = numberField(message, 'runId')
    if (messageRunId === null) {
      return 'apply'
    }
    if (runId !== null && messageRunId < runId) {
      return 'drop'
    }
    // 이후 회차인지, 스냅샷과 같은 회차의 다음 단계인지 판단한다.
    const newRun = runId === null || messageRunId > runId
    if (runId === null && beforeSnapshot(message)) {
      return 'drop'
    }

    let next: number
    let opened: [runQuestionId: number, questionNo: number] | null = null
    switch (message.type) {
      case 'QUESTION_OPENED': {
        const questionNo = numberField(message, 'questionNo')
        const runQuestionId = numberField(message, 'runQuestionId')
        if (questionNo === null || runQuestionId === null) {
          return 'apply'
        }
        next = 2 * questionNo - 1
        if (!newRun && next <= step) {
          return 'drop'
        }
        opened = [runQuestionId, questionNo]
        break
      }
      case 'QUESTION_CLOSED': {
        const runQuestionId = numberField(message, 'runQuestionId')
        const questionNo =
          runQuestionId === null || newRun ? undefined : questionNos.get(runQuestionId)
        if (questionNo === undefined) {
          // 스냅샷 이전 문항의 늦은 마감이면 버리고, 이후라면 열림을 놓친 것이다.
          return beforeSnapshot(message) ? 'drop' : 'resync'
        }
        next = 2 * questionNo
        if (next <= step) {
          return 'drop'
        }
        break
      }
      case 'QUIZ_FINISHED':
        next = RESULT_STEP
        if (!newRun && next <= step) {
          return 'drop'
        }
        break
      case 'QUIZ_CANCELED':
        // 중단하면 결과 없이 바로 대기로 간다(06 6절).
        next = WAITING_STEP
        if (!newRun && next <= step) {
          return 'drop'
        }
        break
      default:
        return 'apply'
    }
    if (newRun) {
      questionNos.clear()
    }
    if (opened) {
      questionNos.set(opened[0], opened[1])
    }
    runId = messageRunId
    step = next
    openQuestionId = opened ? opened[0] : null
    return 'apply'
  }

  function acceptLatestValue(message: RoomRealtimeMessage): FilterVerdict {
    if (message.type === 'ANSWER_PROGRESS' && numberField(message, 'runQuestionId') !== openQuestionId) {
      return 'drop'
    }
    const sentAt = newerThan(message, latestSentAt.get(message.type) ?? snapshotTime)
    if (sentAt === false) {
      return 'drop'
    }
    if (sentAt !== null) {
      latestSentAt.set(message.type, sentAt)
    }
    return 'apply'
  }

  function acceptChat(message: RoomRealtimeMessage): FilterVerdict {
    if (message.type === 'MESSAGE') {
      const id = numberField(message, 'id')
      if (id === null) {
        return 'apply'
      }
      if (seenMessageIds.has(id)) {
        return 'drop'
      }
      seenMessageIds.add(id)
      return 'apply'
    }
    if (NOTICE_TYPES.has(message.type)) {
      const sentAt = newerThan(message, noticeSentAt)
      if (sentAt === false) {
        return 'drop'
      }
      noticeSentAt = sentAt ?? noticeSentAt
    }
    return 'apply'
  }

  return {
    accept(channel: RoomChannel, message: RoomRealtimeMessage): FilterVerdict {
      if (LATEST_VALUE_TYPES.has(message.type)) {
        return acceptLatestValue(message)
      }
      if (channel === 'quiz') {
        return acceptQuiz(message)
      }
      if (channel === 'chat') {
        return acceptChat(message)
      }
      return 'apply'
    },
  }
}

function snapshotStep(phase: string, questionNo: number | undefined): number {
  if (phase === 'RESULT' || questionNo === undefined) {
    return RESULT_STEP
  }
  return phase === 'QUESTION' ? 2 * questionNo - 1 : 2 * questionNo
}

function numberField(message: RoomRealtimeMessage, field: string): number | null {
  const value = message[field]
  return typeof value === 'number' ? value : null
}

/**
 * ISO-8601 시각을 1970년부터의 나노초로 바꾼다. 읽지 못하면 null.
 * 서버는 마이크로초까지 보내는데 Date.parse는 밀리초까지만 읽으므로, 같은 밀리초 안의 앞뒤를 가리려고 직접 읽는다.
 */
export function instantNanos(iso: string): bigint | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(iso)
  if (!match) {
    return null
  }
  const seconds = Date.parse(`${match[1]}${match[3]}`)
  if (Number.isNaN(seconds)) {
    return null
  }
  return BigInt(seconds) * 1_000_000n + BigInt((match[2] ?? '').padEnd(9, '0'))
}
