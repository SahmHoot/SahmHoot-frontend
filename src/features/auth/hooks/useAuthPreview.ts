import { useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthRole } from '../auth.types'

export function useLoginPreview() {
  const navigate = useNavigate()
  const location = useLocation()
  const incoming = location.state as { previewRole?: unknown; signupPreviewCompleted?: unknown } | null
  const [previewRole, setPreviewRole] = useState<AuthRole>(
    import.meta.env.DEV && incoming?.previewRole === 'STUDENT' ? 'STUDENT' : 'PROFESSOR',
  )
  const [feedback, setFeedback] = useState(
    import.meta.env.DEV && incoming?.signupPreviewCompleted === true
      ? '회원가입 미리보기를 완료했습니다. 로그인 버튼으로 선택한 역할의 화면을 확인해 보세요.'
      : '',
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (import.meta.env.DEV) {
      navigate(previewRole === 'PROFESSOR' ? '/professor' : '/student')
      return
    }
    setFeedback('현재 로그인 서비스를 사용할 수 없습니다.')
  }

  return { previewRole, setPreviewRole, feedback, handleSubmit }
}

export function useSignupPreview({ email, code, name, role }: {
  email: string
  code: string
  name: string
  role: AuthRole
}) {
  const navigate = useNavigate()
  const [requestedEmail, setRequestedEmail] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const normalizedEmail = email.trim().toLowerCase()
  const emailVerified = normalizedEmail !== '' && verifiedEmail === normalizedEmail
  const canVerify = requestedEmail !== '' && requestedEmail === normalizedEmail && !emailVerified

  function resetVerification() {
    setRequestedEmail('')
    setVerifiedEmail('')
    setFeedback('')
  }

  function requestCode(event: MouseEvent<HTMLButtonElement>) {
    if (!import.meta.env.DEV) {
      setFeedback('현재 이메일 인증을 사용할 수 없습니다.')
      return
    }
    const emailInput = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="email"]')
    if (!emailInput?.reportValidity()) return
    setRequestedEmail(normalizedEmail)
    setVerifiedEmail('')
    setFeedback('미리보기 인증번호는 000000입니다. 실제 메일은 발송되지 않습니다.')
  }

  function verifyCode() {
    if (!import.meta.env.DEV) {
      setFeedback('현재 이메일 인증을 사용할 수 없습니다.')
      return
    }
    if (!requestedEmail || requestedEmail !== normalizedEmail) {
      setFeedback('현재 이메일로 인증요청을 먼저 눌러 주세요.')
      return
    }
    if (code !== '000000') {
      setFeedback('미리보기 인증번호 000000을 입력해 주세요.')
      return
    }
    setVerifiedEmail(normalizedEmail)
    setFeedback('이메일 확인 미리보기를 완료했습니다.')
  }

  function finishSignup() {
    if (!import.meta.env.DEV) {
      setFeedback('현재 회원가입 서비스를 사용할 수 없습니다.')
      return
    }
    if (!name.trim()) {
      setFeedback('이름을 입력해 주세요.')
      return
    }
    if (!emailVerified) {
      setFeedback('이메일 확인을 먼저 완료해 주세요.')
      return
    }
    navigate('/login', { replace: true, state: { signupPreviewCompleted: true, previewRole: role } })
  }

  return { feedback, emailVerified, canVerify, resetVerification, requestCode, verifyCode, finishSignup }
}
