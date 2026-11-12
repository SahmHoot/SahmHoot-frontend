import type { StudentSession } from '../types/student.types'

const sessionKey = 'sahmhoot.student.session'

export function readSession(): StudentSession | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')
    if (value && typeof value === 'object' && 'code' in value && 'nickname' in value &&
      typeof value.code === 'string' && /^\d{6}$/.test(value.code) &&
      typeof value.nickname === 'string' && value.nickname.trim().length >= 2 && value.nickname.length <= 10) {
      if ('roomId' in value) {
        if (typeof value.roomId !== 'number' || !Number.isSafeInteger(value.roomId) || value.roomId <= 0 ||
          !('title' in value) || typeof value.title !== 'string') return null
        return { code: value.code, nickname: value.nickname, roomId: value.roomId, title: value.title }
      }
      return { code: value.code, nickname: value.nickname }
    }
  } catch { /* Storage may be unavailable in private or restricted browsers. */ }
  return null
}

export function writeSession(value: StudentSession | null) {
  try {
    if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value))
    else sessionStorage.removeItem(sessionKey)
  } catch { /* The current navigation can still carry the session in memory. */ }
}
