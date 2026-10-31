import { useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmVerificationCode, sendVerificationCode, signup, toApiError } from '../api'
import type { ApiError } from '../api'
import type { AuthRole } from '../auth.types'
import { saveSession } from '../session'

/** 05 API 명세 5절 에러 코드별 안내. 없으면 서버 message를 그대로 쓴다. */
function signupErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'VALIDATION_FAILED':
      return error.fieldErrors?.[0]?.message ?? error.message
    case 'EMAIL_ALREADY_EXISTS':
      return '이미 가입된 이메일입니다. 로그인해 주세요.'
    case 'VERIFICATION_TOO_FREQUENT':
      return '인증 코드는 60초에 한 번 보낼 수 있습니다. 잠시 후 다시 요청해 주세요.'
    case 'VERIFICATION_NOT_FOUND':
    case 'VERIFICATION_CODE_EXPIRED':
      return '인증 코드가 만료되었습니다. 인증요청을 다시 눌러 주세요.'
    case 'EMAIL_NOT_VERIFIED':
      return '이메일 인증을 먼저 완료해 주세요.'
    // VERIFICATION_CODE_INVALID는 서버 message에 남은 시도 횟수가 들어 있다.
    default:
      return error.message
  }
}

export function useSignup({ email, code, name, role }: {
  email: string
  code: string
  name: string
  role: AuthRole
}) {
  const navigate = useNavigate()
  const [requestedEmail, setRequestedEmail] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState(false)
  const normalizedEmail = email.trim().toLowerCase()
  const emailVerified = normalizedEmail !== '' && verifiedEmail === normalizedEmail
  const canVerify = requestedEmail !== '' && requestedEmail === normalizedEmail && !emailVerified

  function resetVerification() {
    setRequestedEmail('')
    setVerifiedEmail('')
    setFeedback('')
  }

  async function run(task: () => Promise<void>) {
    setPending(true)
    try {
      await task()
    } catch (error) {
      setFeedback(signupErrorMessage(toApiError(error)))
    } finally {
      setPending(false)
    }
  }

  function requestCode(event: MouseEvent<HTMLButtonElement>) {
    const emailInput = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="email"]')
    if (!emailInput?.reportValidity()) return
    void run(async () => {
      await sendVerificationCode(normalizedEmail)
      setRequestedEmail(normalizedEmail)
      setVerifiedEmail('')
      setFeedback('인증 코드를 보냈습니다. 메일함을 확인해 주세요. 코드는 10분간 유효합니다.')
    })
  }

  function verifyCode() {
    if (!canVerify) {
      setFeedback('현재 이메일로 인증요청을 먼저 눌러 주세요.')
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setFeedback('인증 코드 6자리를 입력해 주세요.')
      return
    }
    void run(async () => {
      await confirmVerificationCode(normalizedEmail, code)
      setVerifiedEmail(normalizedEmail)
      setFeedback('이메일 인증이 완료되었습니다.')
    })
  }

  function finishSignup(password: string) {
    if (!name.trim()) {
      setFeedback('이름을 입력해 주세요.')
      return
    }
    if (!emailVerified) {
      setFeedback('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    void run(async () => {
      const response = await signup({ email: normalizedEmail, code, password, name: name.trim(), role })
      saveSession(response)
      navigate(response.user.role === 'PROFESSOR' ? '/professor' : '/student', { replace: true })
    })
  }

  return { feedback, pending, emailVerified, canVerify, resetVerification, requestCode, verifyCode, finishSignup }
}
