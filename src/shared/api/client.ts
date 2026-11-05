import axios from 'axios'

const TOKEN_KEY = 'sahmhoot.accessToken'
/** 이 탭에서 sessionStorage 세션을 로그아웃했다는 표시. 다른 탭의 localStorage 토큰으로 넘어가지 않게 한다. */
const SIGNED_OUT_KEY = 'sahmhoot.signedOut'

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 로그인 토큰. '로그인 상태 유지'를 고르면 localStorage에 두어 14일 유지하고(ACC-04),
 * 고르지 않으면 sessionStorage에 두어 탭을 닫을 때 지운다.
 * 이 탭만의 sessionStorage 토큰을 먼저 쓰므로, 다른 탭의 로그인·로그아웃이 이 탭의 세션을 바꾸지 않는다.
 */
export const tokenStorage = {
  get(): string | null {
    try {
      const sessionToken = sessionStorage.getItem(TOKEN_KEY)
      if (sessionToken !== null) return sessionToken
      if (sessionStorage.getItem(SIGNED_OUT_KEY) !== null) return null
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string, persistent: boolean): void {
    tokenStorage.clear()
    sessionStorage.removeItem(SIGNED_OUT_KEY)
    ;(persistent ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  },
  /** 이 탭이 쓰는 토큰만 지운다. 여러 번 불러도 다른 탭의 토큰은 지우지 않는다. */
  clear(): void {
    try {
      if (sessionStorage.getItem(TOKEN_KEY) !== null) {
        sessionStorage.removeItem(TOKEN_KEY)
        sessionStorage.setItem(SIGNED_OUT_KEY, '1')
      } else if (sessionStorage.getItem(SIGNED_OUT_KEY) === null) {
        localStorage.removeItem(TOKEN_KEY)
      }
    } catch { /* 저장소를 못 쓰면 지울 토큰도 없다. */ }
  },
  /** 이 탭이 localStorage 토큰을 쓰는데 다른 탭이 그 토큰을 바꾸거나 지웠을 때 부른다. 해제 함수를 돌려준다. */
  onSharedChange(listener: () => void): () => void {
    const handle = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY || event.storageArea !== localStorage) return
      try {
        if (sessionStorage.getItem(TOKEN_KEY) !== null || sessionStorage.getItem(SIGNED_OUT_KEY) !== null) return
      } catch { /* sessionStorage를 못 쓰면 localStorage 토큰을 쓰는 탭이다. */ }
      listener()
    }
    window.addEventListener('storage', handle)
    return () => window.removeEventListener('storage', handle)
  },
}

let unauthorizedHandler: (() => void) | null = null

/** 토큰을 붙인 요청이 401 UNAUTHORIZED를 받으면 부를 함수. 토큰 삭제도 이 함수가 맡는다. 앱에서 한 번 등록한다. */
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
    unauthorizedHandler?.()
  }
  return Promise.reject(error)
})
