import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler } from '../../shared/api/client'
import { configureStomp, disconnectStomp } from '../../shared/stomp'
import { fetchMe } from './api'
import type { AuthResponse, AuthUser } from './api'
import { clearSession, getAccessToken, saveReturnTo, saveSession } from './session'

/** loading: 저장된 토큰을 /users/me로 확인하는 중. */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  signIn: (response: AuthResponse) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** 로그인 상태를 앱 전체에 제공한다. BrowserRouter 안에 둔다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'loading' : 'signedOut'))

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

  useEffect(() => {
    if (status !== 'loading') return
    let cancelled = false
    fetchMe()
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('signedIn')
      })
      .catch(() => {
        // 401이면 expire()가 이미 처리했다. 서버에 닿지 못한 경우는 토큰을 남기고 로그인 화면으로 보낸다.
        if (!cancelled) setStatus('signedOut')
      })
    return () => {
      cancelled = true
    }
  }, [status])

  const signIn = useCallback((response: AuthResponse) => {
    saveSession(response)
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

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('AuthProvider 안에서만 useAuth()를 쓸 수 있습니다.')
  }
  return value
}
