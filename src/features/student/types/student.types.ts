export type RoomPhase = 'waiting' | 'question' | 'closing' | 'feedback' | 'results'
export type Reaction = '👍' | '❓' | '😄' | '👏'

export interface StudentSession {
  code: string
  nickname: string
  roomId?: number
  title?: string
}

/** GET /api/rooms/by-code/{joinCode}. */
export interface RoomByCodeResponse {
  roomId: number
  title: string
  ownerName: string
  status: 'OPEN' | 'PLAYING' | 'CLOSED'
  joined: boolean
  isOwner: boolean
  myNickname: string | null
}

/** POST /api/rooms/by-code/{joinCode}/participants. */
export interface JoinRoomResponse {
  roomId: number
  participantId: number
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
