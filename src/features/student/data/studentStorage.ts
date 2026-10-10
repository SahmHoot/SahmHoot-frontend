import type { StudentSession } from '../types/student.types'

const sessionKey = 'sahmhoot.student.session'

export function readSession(): StudentSession | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')
    if (value && typeof value === 'object' && 'code' in value && 'nickname' in value &&
      typeof value.code === 'string' && /^\d{6}$/.test(value.code) &&
      typeof value.nickname === 'string' && value.nickname.trim().length >= 2 && value.nickname.length <= 10) {
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

export function readAnswers(setId: string, count: number): (number | null)[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`sahmhoot.student.answers.${setId}`) ?? 'null')
    if (Array.isArray(value) && value.length === count && value.every(answer =>
      answer === null || (Number.isInteger(answer) && answer >= 0 && answer < 4))) return value
  } catch { /* Fall back to unanswered questions. */ }
  return Array.from({ length: count }, () => null)
}

export function saveAnswers(setId: string, answers: (number | null)[]) {
  try { localStorage.setItem(`sahmhoot.student.answers.${setId}`, JSON.stringify(answers)) }
  catch { /* Quiz interactions remain available without persistence. */ }
}
