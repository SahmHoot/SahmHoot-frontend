/**
 * 퀴즈 REST 응답과 실시간 메시지 타입.
 * 필드 이름은 백엔드 DTO(`quiz/dto`, `questionset/dto`)와 똑같이 맞춘다.
 * 시각은 모두 ISO-8601 UTC 문자열이다.
 */

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE'

/** GET /api/question-sets/mine 항목. */
export interface QuestionSetSummary {
  id: number
  title: string
  visibility: 'PRIVATE' | 'PUBLIC'
  questionCount: number
  used: boolean
  updatedAt: string
}

/** POST /api/rooms/{roomId}/quiz-runs 응답. 문제 내용은 QUESTION_OPENED로 받는다. */
export interface StartQuizResponse {
  runId: number
  totalQuestions: number
  firstRunQuestionId: number
  closesAt: string
}

/** 진행 중 문항의 선택지. 정답 여부는 담겨 있지 않다. */
export interface RunChoice {
  id: number
  orderNo: number
  content: string
}

export interface ChoiceResult extends RunChoice {
  count: number
}

export interface QuestionResult {
  runQuestionId: number
  questionNo: number
  content: string
  correctChoiceId: number
  answeredCount: number
  correctCount: number
  incorrectCount: number
  choices: ChoiceResult[]
}

export interface QuizResult {
  questions: QuestionResult[]
}

export interface QuestionOpenedMessage {
  type: 'QUESTION_OPENED'
  sentAt: string
  runId: number
  runQuestionId: number
  questionNo: number
  totalQuestions: number
  questionType: QuestionType
  content: string
  timeLimitSeconds: number
  closesAt: string
  choices: RunChoice[]
}

/** 정답(correctChoiceId)이 담겨 오지만 교수 화면에는 표시하지 않는다(QZ-05). */
export interface QuestionClosedMessage {
  type: 'QUESTION_CLOSED'
  sentAt: string
  runId: number
  runQuestionId: number
  correctChoiceId: number
  isLast: boolean
  nextOpensAt: string
}

export interface QuizFinishedMessage {
  type: 'QUIZ_FINISHED'
  sentAt: string
  runId: number
  result: QuizResult
}

export interface QuizCanceledMessage {
  type: 'QUIZ_CANCELED'
  sentAt: string
  runId: number
}

export interface RoomWaitingMessage {
  type: 'ROOM_WAITING'
  sentAt: string
}

/** 소유자 큐로만 온다. 증가분이 아니라 그 문항의 전체 응답 인원이다. */
export interface AnswerProgressMessage {
  type: 'ANSWER_PROGRESS'
  sentAt: string
  runQuestionId: number
  answeredCount: number
}

/** 교수 퀴즈 화면이 처리하는 메시지. */
export type ProfessorQuizMessage =
  | QuestionOpenedMessage
  | QuestionClosedMessage
  | QuizFinishedMessage
  | QuizCanceledMessage
  | RoomWaitingMessage
  | AnswerProgressMessage
