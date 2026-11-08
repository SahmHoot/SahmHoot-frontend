import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { login, toApiError } from '../api'
import type { ApiError } from '../api'
import type { AuthRole } from '../auth.types'
import { useAuth } from '../AuthProvider'
import { homePath, setPreviewRole as savePreviewRole, takeReturnTo } from '../session'

function loginErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return '이메일 또는 비밀번호가 올바르지 않습니다.'
    case 'VALIDATION_FAILED':
      return '이메일과 비밀번호를 입력해 주세요.'
    default:
      return error.message
  }
}

export function useLogin({ email, password, keepLoggedIn }: { email: string; password: string; keepLoggedIn: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const incoming = location.state as { previewRole?: unknown } | null
  const [previewRole, setPreviewRole] = useState<AuthRole>(
    import.meta.env.DEV && incoming?.previewRole === 'STUDENT' ? 'STUDENT' : 'PROFESSOR',
  )
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState(false)
  // 로그인 직후에는 화면의 '이미 로그인됨' 이동 대신 아래 navigate(돌아갈 주소)를 따른다.
  const [signedInHere, setSignedInHere] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    // 개발 서버에서 이메일을 비워 두면 계정 없이 화면 미리보기로 이동한다.
    if (import.meta.env.DEV && normalizedEmail === '') {
      savePreviewRole(previewRole)
      navigate(homePath(previewRole))
      return
    }
    if (!password) {
      setFeedback('비밀번호를 입력해 주세요.')
      return
    }
    setPending(true)
    login(normalizedEmail, password)
      .then((response) => {
        setSignedInHere(true)
        auth.signIn(response, keepLoggedIn)
        navigate(takeReturnTo() ?? homePath(response.user.role), { replace: true })
      })
      .catch((error: unknown) => {
        setFeedback(loginErrorMessage(toApiError(error)))
        setPending(false)
      })
  }

  return { previewRole, setPreviewRole, feedback, pending, signedInHere, handleSubmit }
}
