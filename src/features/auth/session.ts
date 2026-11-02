import type { AuthResponse } from './api'

const TOKEN_KEY = 'sahmhoot.accessToken'

/** 가입·로그인 응답의 토큰을 보관한다. 요청 헤더 첨부·401 처리·로그아웃은 #44. */
export function saveSession(response: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, response.accessToken)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
