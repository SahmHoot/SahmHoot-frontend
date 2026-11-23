import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler, tokenStorage } from '../../shared/api/client'
import { configureStomp, disconnectStomp } from '../../shared/stomp'
import { fetchMe, isUnauthorized } from './api'
import type { AuthResponse, AuthUser } from './api'
import { clearReturnTo, clearSession, getAccessToken, getPreviewRole, saveReturnTo, saveSession } from './session'

/**
 * loading: 저장된 토큰을 /users/me로 확인하는 중.
 * unavailable: 서버에 닿지 못해 확인하지 못함(서버 중단·네트워크 끊김). 토큰은 남겨 두고 다시 시도할 수 있다.
 */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'unavailable'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  /**
   * 이 탭에서 signOut을 부른 화면의 라우터 위치 키. 다른 위치로 이동이 반영되면 null이 된다.
   * 라우터 이동은 전환(startTransition)으로 늦게 반영되어 로그아웃 상태가 먼저 그 화면에 그려지므로,
   * RequireAuth가 그 화면을 돌아갈 주소로 저장하지 않게 하는 데 쓴다(#127).
   */
  signedOutKey: string | null
  signIn: (response: AuthResponse, keepLoggedIn: boolean) => void
  signOut: () => void
  /** unavailable일 때 저장된 토큰을 /users/me로 다시 확인한다. */
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** 로그인 상태를 앱 전체에 제공한다. BrowserRouter 안에 둔다. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'loading' : 'signedOut'))
  // 확인 중에 토큰이 바뀌면 값을 올려 이전 /users/me 응답을 버린다.
  const [validation, setValidation] = useState(0)
  const [signedOutKey, setSignedOutKey] = useState<string | null>(null)
  // signOut이 직전 상태와 화면에 그려진 위치를 본다. 로그인해 있던 탭에 남은 돌아갈 주소는 이전 계정 것이다.
  const statusRef = useRef(status)
  const locationKeyRef = useRef(location.key)
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    locationKeyRef.current = location.key
  }, [location.key])

  // 다른 위치(로그인 화면, 뒤로 가기로 연 QR 주소 등)로 이동이 반영되면 푼다. 그 뒤로는 평소대로 저장한다(RM-09).
  useEffect(() => {
    if (signedOutKey !== null && location.key !== signedOutKey) setSignedOutKey(null)
  }, [signedOutKey, location.key])

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
    // 다른 탭의 로그아웃은 직접 로그아웃과 401 만료를 구분할 수 없어, 만료처럼 현재 화면을 돌아갈 주소로 남긴다(RM-09).
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
    // 로그인(또는 화면 미리보기) 중이었다면 남아 있던 돌아갈 주소도 버린다. 다음 계정이 이전 계정의 QR 주소로
    // 가지 않게 한다. 로그인하지 않은 채 비밀번호를 재설정한 경우에는 QR로 들어와 저장한 주소를 남긴다(RM-09).
    if (statusRef.current !== 'signedOut' || getPreviewRole()) clearReturnTo()
    clearSession()
    void disconnectStomp()
    setUser(null)
    setStatus('signedOut')
    setSignedOutKey(locationKeyRef.current)
    navigate('/login', { replace: true })
  }, [navigate])

  const retry = useCallback(() => {
    setStatus('loading')
    setValidation((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ status, user, signedOutKey, signIn, signOut, retry }),
    [status, user, signedOutKey, signIn, signOut, retry],
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
