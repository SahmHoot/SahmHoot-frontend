import { isAxiosError } from 'axios'
import { apiClient } from '../../shared/api/client'
import type { AuthRole } from './auth.types'

/** 05 API 명세 #3·#4 응답의 user. */
export interface AuthUser {
  id: number
  email: string
  name: string
  role: AuthRole
}

/** 05 API 명세 #3·#4 응답. */
export interface AuthResponse {
  accessToken: string
  expiresAt: string
  user: AuthUser
}

export interface SignupRequest {
  email: string
  code: string
  password: string
  name: string
  role: AuthRole
  studentNumber?: string
}

/** 서버 오류 응답(05 5절). 서버에 닿지 못하면 code가 NETWORK_ERROR. */
export interface ApiError {
  status: number
  code: string
  message: string
  fieldErrors?: { field: string; message: string }[]
}

/** 05 #1 인증 코드 발송. 성공 204. */
export async function sendVerificationCode(email: string): Promise<void> {
  await apiClient.post('/auth/email-verifications', { email })
}

/** 05 #2 인증 코드 확인. 성공 204. */
export async function confirmVerificationCode(email: string, code: string): Promise<void> {
  await apiClient.post('/auth/email-verifications/confirm', { email, code })
}

/** 05 #3 회원가입. 성공 201 + 토큰. */
export async function signup(request: SignupRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/signup', request)
  return data
}

export function toApiError(error: unknown): ApiError {
  if (isAxiosError(error)) {
    const data: unknown = error.response?.data
    if (data && typeof data === 'object' && typeof (data as ApiError).code === 'string') {
      return data as ApiError
    }
  }
  return { status: 0, code: 'NETWORK_ERROR', message: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }
}
