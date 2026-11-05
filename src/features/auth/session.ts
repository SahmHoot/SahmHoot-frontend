import { tokenStorage } from '../../shared/api/client'
import type { AuthResponse } from './api'
import type { AuthRole } from './auth.types'

const RETURN_TO_KEY = 'sahmhoot.returnTo'
const PREVIEW_ROLE_KEY = 'sahmhoot.previewRole'

/** 가입·로그인 응답의 토큰을 보관한다. keepLoggedIn이 false면 탭을 닫을 때 지워진다. */
export function saveSession(response: AuthResponse, keepLoggedIn: boolean): void {
  tokenStorage.set(response.accessToken, keepLoggedIn)
  clearPreviewRole()
}

export function clearSession(): void {
  tokenStorage.clear()
  clearPreviewRole()
}

/** 만료되지 않은 토큰. 서명은 서버가 검사하고(/users/me 401), 여기서는 exp만 본다. */
export function getAccessToken(): string | null {
  const token = tokenStorage.get()
  if (token && isExpired(token)) {
    tokenStorage.clear()
    return null
  }
  return token
}

export function homePath(role: AuthRole): string {
  return role === 'PROFESSOR' ? '/professor' : '/student'
}

/** 로그인 후 돌아갈 주소(RM-09). 회원가입을 거쳐도 남도록 sessionStorage에 둔다. */
export function saveReturnTo(path: string): void {
  if (path === '/' || path.startsWith('/login') || path.startsWith('/signup')) return
  try {
    sessionStorage.setItem(RETURN_TO_KEY, path)
  } catch { /* 돌아갈 주소 없이 역할별 홈으로 간다. */ }
}

/** 보관한 주소를 꺼내고 지운다. 다른 사이트 주소는 버린다. */
export function takeReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
    return path?.startsWith('/') && !path.startsWith('//') ? path : null
  } catch {
    return null
  }
}

/** 개발 서버의 화면 미리보기(계정 없이 역할만 골라 이동). 운영 빌드에서는 항상 null. */
export function getPreviewRole(): AuthRole | null {
  if (!import.meta.env.DEV) return null
  try {
    const role = sessionStorage.getItem(PREVIEW_ROLE_KEY)
    return role === 'PROFESSOR' || role === 'STUDENT' ? role : null
  } catch {
    return null
  }
}

export function setPreviewRole(role: AuthRole): void {
  try {
    sessionStorage.setItem(PREVIEW_ROLE_KEY, role)
  } catch { /* 미리보기는 저장소 없이도 이번 이동에는 동작한다. */ }
}

function clearPreviewRole(): void {
  try {
    sessionStorage.removeItem(PREVIEW_ROLE_KEY)
  } catch { /* 지울 값이 없다. */ }
}

function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 <= Date.now()
  } catch {
    return false
  }
}
