export type RoomPhase = 'waiting' | 'question' | 'closing' | 'feedback' | 'results'
export type RoomPreview = 'waiting' | 'question' | 'results' | null
export type Reaction = '👍' | '❓' | '😄' | '👏'

export interface StudentSession {
  code: string
  nickname: string
}

export interface QuizQuestion {
  id: string
  title: string
  options: string[]
  correctAnswer: number
  duration: number
  correctRate: number
  responseCount: number
}

export interface QuizSet {
  id: string
  title: string
  subject: string
  questions: QuizQuestion[]
}

export interface ChatMessage {
  id: string
  nickname: string
  text: string
  role: 'student' | 'professor'
  mine?: boolean
  reply?: string
}

export interface FloatingReaction {
  id: string
  emoji: Reaction
  expiresAt: number
}
