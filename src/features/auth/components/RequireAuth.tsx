import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { AuthRole } from '../auth.types'
import { useAuth } from '../AuthProvider'
import { getPreviewRole, homePath, saveReturnTo } from '../session'

/** 로그인한 해당 역할 사용자만 들여보낸다. 다른 역할이면 그 역할의 홈으로 보낸다. */
export function RequireAuth({ role, children }: { role: AuthRole; children: ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (status === 'signedOut') {
    const previewRole = getPreviewRole()
    if (previewRole === role) return children
    if (previewRole) return <Navigate to={homePath(previewRole)} replace />
    saveReturnTo(location.pathname + location.search)
    return <Navigate to="/login" replace />
  }
  if (user && user.role !== role) return <Navigate to={homePath(user.role)} replace />
  return children
}

/** `/`로 들어오면 로그인 상태에 따라 역할별 홈 또는 로그인 화면으로 보낸다. */
export function HomeRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') return null
  return <Navigate to={user ? homePath(user.role) : '/login'} replace />
}
