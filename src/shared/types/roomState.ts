/**
 * GET /api/rooms/{roomId}/state 응답(05 #21). 백엔드 RoomStateResponse와 필드 이름을 맞춘다.
 * 시각은 ISO-8601 UTC 문자열이다.
 */
export interface RoomStateResponse {
  /** 스냅샷을 만든 서버 시각. 이보다 이르거나 같은 집계 메시지는 이미 반영된 것이다(06 1절). */
  serverTime: string
  room: RoomStateRoom
  /** 가장 최근 회차의 상태. 회차가 없으면 null. */
  quizRun: { status: QuizRunStatus } | null
  me: RoomStateMe
  onlineCount: number
  /** 방이 OPEN(대기)이면 null. */
  quiz: RoomStateQuiz | null
  pinnedMessage: RoomChatMessage | null
  recentMessages: RoomChatMessage[]
  /** 방 소유자이고 문항이 열려 있을 때만 온다. */
  progress?: { runQuestionId: number; answeredCount: number }
  /** 방 소유자에게만 온다. 이모지별 최근 60초 횟수. */
  reactionStats?: Record<string, number>
}

export type RoomStatus = 'OPEN' | 'PLAYING' | 'CLOSED'
export type QuizRunStatus = 'READY' | 'RUNNING' | 'FINISHED' | 'ABORTED'
export type QuizPhase = 'QUESTION' | 'FEEDBACK' | 'RESULT'

export interface RoomStateRoom {
  id: number
  title: string
  status: RoomStatus
  joinCode: string
  joinUrl: string
  ownerName: string
}

export interface RoomStateMe {
  participantId: number
  nickname: string
  isOwner: boolean
  chatBlocked: boolean
}

export interface RoomStateQuiz {
  runId: number
  questionSetTitle: string
  totalQuestions: number
  phase: QuizPhase
  /** RESULT 단계에서는 null. */
  currentQuestion: RoomStateQuestion | null
  /** FEEDBACK 단계에서만 값이 있다. */
  nextOpensAt: string | null
  /** 참가자에게만 온다. */
  myAnswers?: { runQuestionId: number; choiceId: number }[]
  /** RESULT 단계에서만 값이 있다. */
  result: { questions: RoomStateQuestionResult[] } | null
}

export interface RoomStateQuestion {
  runQuestionId: number
  questionNo: number
  questionType: string
  timeLimitSeconds: number
  content: string
  choices: { id: number; orderNo: number; content: string }[]
  openedAt: string
  closesAt: string
  closedAt: string | null
  /** FEEDBACK 단계에서만 값이 있다. */
  correctChoiceId: number | null
}

export interface RoomStateQuestionResult {
  runQuestionId: number
  questionNo: number
  content: string
  correctChoiceId: number
  answeredCount: number
  correctCount: number
  incorrectCount: number
  choices: { id: number; orderNo: number; content: string; count: number }[]
}

/** 채팅 메시지 형태(05 공통 규칙). state, 공지 고정, 06 MESSAGE가 같은 형태를 쓴다. */
export interface RoomChatMessage {
  id: number
  senderParticipantId: number
  nickname: string
  isOwner: boolean
  content: string
  parentId: number | null
  parentPreview: string | null
  createdAt: string
}
