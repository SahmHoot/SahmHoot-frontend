import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler, tokenStorage } from '../../shared/api/client'
import { configureStomp, disconnectStomp } from '../../shared/stomp'
import { fetchMe, isUnauthorized } from './api'
import type { AuthResponse, AuthUser } from './api'
import { clearSession, getAccessToken, saveReturnTo, saveSession } from './session'

/**
 * loading: 저장된 토큰을 /users/me로 확인하는 중.
 * unavailable: 서버에 닿지 못해 확인하지 못함(서버 중단·네트워크 끊김). 토큰은 남겨 두고 다시 시도할 수 있다.
 */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'unavailable'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  signIn: (response: AuthResponse, keepLoggedIn: boolean) => void
  signOut: () => void
  /** unavailable일 때 저장된 토큰을 /users/me로 다시 확인한다. */
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** 로그인 상태를 앱 전체에 제공한다. BrowserRouter 안에 둔다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'loading' : 'signedOut'))
  // 확인 중에 토큰이 바뀌면 값을 올려 이전 /users/me 응답을 버린다.
  const [validation, setValidation] = useState(0)

  const expire = useCallback(() => {
    clearSession()
    void disconnectStomp()
    setUser(null)
    setStatus('signedOut')
    // 401은 화면 밖(요청 응답)에서 오므로 라우터 상태 대신 현재 주소를 직접 읽는다.
    saveReturnTo(window.location.pathname + window.location.search)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(expire)
    configureStomp({ getToken: getAccessToken, onUnauthorized: expire })
    return () => setUnauthorizedHandler(null)
  }, [expire])

  // 다른 탭에서 같은 저장소의 계정을 바꾸거나 로그아웃하면 이 탭의 사용자 정보도 다시 맞춘다.
  useEffect(() => tokenStorage.onSharedChange(() => {
    setUser(null)
    if (getAccessToken()) {
      setStatus('loading')
      setValidation((n) => n + 1)
      return
    }
    void disconnectStomp()
    setStatus('signedOut')
    navigate('/login', { replace: true })
  }), [navigate])

  useEffect(() => {
    if (status !== 'loading') return
    let cancelled = false
    fetchMe()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('signedIn')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        // 서버가 401로 답했을 때만 로그인이 끝난 것으로 본다. 토큰 삭제와 이동은 인터셉터의 expire()가 맡고
        // (401 UNAUTHORIZED), 여기서는 상태만 맞춘다. 서버 중단·네트워크 끊김·5xx는 로그아웃이 아니므로
        // 토큰을 남기고 연결 안내와 다시 시도를 보여 준다.
        setStatus(isUnauthorized(error) ? 'signedOut' : 'unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [status, validation])

  const signIn = useCallback((response: AuthResponse, keepLoggedIn: boolean) => {
    saveSession(response, keepLoggedIn)
    setUser(response.user)
    setStatus('signedIn')
  }, [])

  const signOut = useCallback(() => {
    clearSession()
    void disconnectStomp()
    setUser(null)
    setStatus('signedOut')
    navigate('/login', { replace: true })
  }, [navigate])

  const retry = useCallback(() => {
    setStatus('loading')
    setValidation((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ status, user, signIn, signOut, retry }),
    [status, user, signIn, signOut, retry],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('AuthProvider 안에서만 useAuth()를 쓸 수 있습니다.')
  }
  return value
}
