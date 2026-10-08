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
  name: string
  code: string
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
