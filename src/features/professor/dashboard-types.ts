import type { ChoiceResponse } from '../questionset/questionset.types'

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

/** 수업방은 서버 식별자와 문항별 시간을 사용한다. 기존 예시 데이터 모델과 구분한다. */
export interface RoomQuestion extends Omit<Question, 'id'> {
  id: number
  orderNo: number
  timeLimitSeconds: number
  choices: ChoiceResponse[]
}

export interface RoomQuestionSet extends Omit<QuestionSet, 'id' | 'seconds' | 'questions'> {
  id: number
  questions: RoomQuestion[]
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
  set: RoomQuestionSet | null
}
