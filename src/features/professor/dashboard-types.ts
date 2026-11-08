export interface Question {
  id: string
  title: string
  prompt: string
  type: 'multiple' | 'ox'
  options: string[]
  answer: number
}

export interface QuestionSet {
  id: string
  name: string
  seconds: number
  isPublic: boolean
  questions: Question[]
}

export interface Room {
  /** 서버 방 ID. 고른 방이 없으면 null. */
  id: number | null
  name: string
  code: string
  /** 개설 응답의 입장 주소. 목록에서 연 방은 응답에 없어서 null. */
  joinUrl: string | null
  participants: number
  active: boolean
}

export interface ChatMessage {
  id: string
  author: string
  text: string
  professor?: boolean
  reply?: string
}

export type DesignScreen = 'home' | 'create' | 'sets' | 'editor' | 'waiting' | 'quiz' | 'results'
export type QuizState = {
  phase: 'waiting' | 'running' | 'between' | 'results'
  index: number
  remaining: number
  set: QuestionSet | null
}
