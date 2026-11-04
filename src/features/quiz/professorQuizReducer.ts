import { clockOffsetMs } from './serverClock'
import type {
  ProfessorQuizMessage,
  QuestionOpenedMessage,
  QuestionType,
  QuizResult,
  RunChoice,
} from './types'

/** 진행 중인 문항. 정답은 일부러 담지 않아 화면에 나갈 수 없게 한다(QZ-05). */
export interface ActiveQuestion {
  runId: number
  runQuestionId: number
  questionNo: number
  totalQuestions: number
  questionType: QuestionType
  content: string
  choices: RunChoice[]
  closesAt: string
  answeredCount: number
  clockOffsetMs: number
}

/**
 * 교수 화면 상태. DB 상태가 아니라 메시지에서 파생한 화면 상태다.
 * - waiting: 대기
 * - question: 문항 진행 중. 남은 시간이 0이면 화면은 "마감 중"을 표시한다
 * - between: 문항이 닫힌 뒤 다음 문항·결과까지 3초
 * - results: 결과 화면
 */
export type ProfessorQuizState =
  | { phase: 'waiting' }
  | ({ phase: 'question' } & ActiveQuestion)
  | ({ phase: 'between'; nextOpensAt: string; isLast: boolean } & ActiveQuestion)
  | { phase: 'results'; runId: number; result: QuizResult }

export type ProfessorQuizAction =
  | { kind: 'message'; message: ProfessorQuizMessage; receivedAt: number }
  | { kind: 'reset' }

export const initialProfessorQuiz: ProfessorQuizState = { phase: 'waiting' }

const MESSAGE_TYPES: ReadonlySet<string> = new Set<ProfessorQuizMessage['type']>([
  'QUESTION_OPENED',
  'QUESTION_CLOSED',
  'QUIZ_FINISHED',
  'QUIZ_CANCELED',
  'ROOM_WAITING',
  'ANSWER_PROGRESS',
])

/** 채널에서 받은 값을 메시지로 바꾼다. 모르는 type은 null로 돌려 무시한다(06 4절). */
export function toProfessorQuizMessage(body: unknown): ProfessorQuizMessage | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const { type } = body as { type?: unknown }
  return typeof type === 'string' && MESSAGE_TYPES.has(type)
    ? (body as ProfessorQuizMessage)
    : null
}

/**
 * 메시지를 화면 상태로 바꾼다. 재연결이나 중복 수신으로 같은 메시지가 다시 와도
 * 이미 지나간 단계로 돌아가지 않도록 회차·문항·진행 순서를 확인한다(06 1절).
 */
export function professorQuizReducer(
  state: ProfessorQuizState,
  action: ProfessorQuizAction,
): ProfessorQuizState {
  if (action.kind === 'reset') {
    return initialProfessorQuiz
  }
  const { message, receivedAt } = action

  switch (message.type) {
    case 'QUESTION_OPENED':
      return isStaleOpen(state, message)
        ? state
        : {
            phase: 'question',
            runId: message.runId,
            runQuestionId: message.runQuestionId,
            questionNo: message.questionNo,
            totalQuestions: message.totalQuestions,
            questionType: message.questionType,
            content: message.content,
            choices: message.choices,
            closesAt: message.closesAt,
            answeredCount: 0,
            clockOffsetMs: clockOffsetMs(message.sentAt, receivedAt),
          }

    case 'QUESTION_CLOSED':
      if (state.phase !== 'question' || state.runQuestionId !== message.runQuestionId) {
        return state
      }
      return {
        ...state,
        phase: 'between',
        nextOpensAt: message.nextOpensAt,
        isLast: message.isLast,
        clockOffsetMs: clockOffsetMs(message.sentAt, receivedAt),
      }

    case 'QUIZ_FINISHED':
      if (state.phase === 'results' && state.runId === message.runId) {
        return state
      }
      return { phase: 'results', runId: message.runId, result: message.result }

    case 'QUIZ_CANCELED':
      return state.phase !== 'waiting' && state.runId === message.runId
        ? initialProfessorQuiz
        : state

    case 'ROOM_WAITING':
      return initialProfessorQuiz

    case 'ANSWER_PROGRESS':
      // 마감 직전에 낸 답의 집계가 마감 뒤에 도착할 수 있어 between에서도 반영한다.
      if (
        (state.phase === 'question' || state.phase === 'between') &&
        state.runQuestionId === message.runQuestionId
      ) {
        return { ...state, answeredCount: message.answeredCount }
      }
      return state
  }
}

/** 같은 회차에서 이미 지나간 문항이거나, 결과까지 끝난 회차의 늦은 메시지인지 확인한다. */
function isStaleOpen(state: ProfessorQuizState, message: QuestionOpenedMessage): boolean {
  if (state.phase === 'waiting' || state.runId !== message.runId) {
    return false
  }
  return state.phase === 'results' || message.questionNo <= state.questionNo
}
