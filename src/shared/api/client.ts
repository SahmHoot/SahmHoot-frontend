import axios from 'axios'

const TOKEN_KEY = 'sahmhoot.accessToken'

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/** 로그인 토큰. 14일 유지(ACC-04)를 위해 localStorage에 둔다. */
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch { /* 저장소를 못 쓰면 지울 토큰도 없다. */ }
  },
}

let unauthorizedHandler: (() => void) | null = null

/** 토큰을 붙인 요청이 401 UNAUTHORIZED를 받으면 부를 함수. 앱에서 한 번 등록한다. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(undefined, (error: unknown) => {
  // 로그인 실패(INVALID_CREDENTIALS)도 401이므로 code가 UNAUTHORIZED일 때만 세션을 끝낸다.
  // 그사이 다시 로그인했다면 늦게 온 이전 토큰의 401이 새 토큰을 지우지 않도록 같은 토큰일 때만 처리한다.
  const token = tokenStorage.get()
  if (axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    (error.response.data as { code?: unknown } | undefined)?.code === 'UNAUTHORIZED' &&
    token !== null &&
    error.config?.headers.Authorization === `Bearer ${token}`) {
    tokenStorage.clear()
    unauthorizedHandler?.()
  }
  return Promise.reject(error)
})
