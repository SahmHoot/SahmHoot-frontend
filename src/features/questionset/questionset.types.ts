export type Visibility = 'PUBLIC' | 'PRIVATE'
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE'

export interface CreateQuestionSetRequest {
  title: string
  description?: string | null
  /** 생략하거나 null이면 PRIVATE. */
  visibility?: Visibility | null
}

export interface UpdateQuestionSetRequest {
  title?: string
  /** 생략하면 유지하고, null이면 설명을 지운다. */
  description?: string | null
  visibility?: Visibility
}

export interface QuestionSetSummaryResponse {
  id: number
  title: string
  visibility: Visibility
  questionCount: number
  used: boolean
  /** ISO-8601 UTC. */
  updatedAt: string
}

export interface QuestionSetDetailResponse {
  id: number
  title: string
  visibility: Visibility
  description: string | null
  ownerName: string
  questions: QuestionResponse[]
}

export interface ChoiceRequest {
  content: string
  isCorrect: boolean
}

export interface QuestionWriteRequest {
  type: QuestionType
  content: string
  /** 10~300초. 생략하거나 null이면 60초. */
  timeLimitSeconds?: number | null
  /** MULTIPLE_CHOICE는 4개, TRUE_FALSE는 O/X 2개. 정답은 정확히 1개. */
  choices: ChoiceRequest[]
}

export interface ChoiceResponse {
  id: number
  orderNo: number
  content: string
  isCorrect: boolean
}

export interface QuestionResponse {
  id: number
  orderNo: number
  type: QuestionType
  content: string
  timeLimitSeconds: number
  choices: ChoiceResponse[]
}

export interface ReorderQuestionsRequest {
  /** 세트의 모든 문항 ID를 새 순서대로 전달한다. */
  questionIds: number[]
}

export interface QuestionSetErrorResponse {
  status: number
  code: string
  message: string
  fieldErrors?: { field: string; message: string }[]
}
