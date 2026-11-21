import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmVerificationCode, sendVerificationCode, signup, toApiError } from '../api'
import type { AuthRole } from '../auth.types'
import { useAuth } from '../AuthProvider'
import { homePath, takeReturnTo } from '../session'
import { useEmailVerification, verificationErrorMessage } from './useEmailVerification'

export function useSignup({ email, code, name, role }: {
  email: string
  code: string
  name: string
  /** 아직 고르지 않았으면 null. 기본값을 두지 않아 학생이 교수로 가입되는 일을 막는다(#93). */
  role: AuthRole | null
}) {
  const navigate = useNavigate()
  const auth = useAuth()
  const verification = useEmailVerification({
    email, code,
    sendCode: sendVerificationCode,
    confirmCode: confirmVerificationCode,
    sentMessage: '인증 코드를 보냈습니다. 메일함을 확인해 주세요. 코드는 10분간 유효합니다.',
  })
  // 가입하기 결과는 가입하기 버튼 아래에 보인다. 인증 단계 안내는 각 입력칸 아래에 있다.
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function resetVerification() {
    verification.reset()
    setFeedback('')
  }

  function finishSignup(password: string) {
    if (!name.trim()) {
      setFeedback('이름을 입력해 주세요.')
      return
    }
    if (!verification.verified) {
      setFeedback('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    if (!role) {
      setFeedback('교수 또는 학생을 선택해 주세요.')
      return
    }
    setSubmitting(true)
    signup({ email: verification.normalizedEmail, code, password, name: name.trim(), role })
      .then((response) => {
        // 가입 화면에는 '로그인 상태 유지' 선택이 없어 기본으로 유지한다.
        auth.signIn(response, true)
        navigate(takeReturnTo() ?? homePath(response.user.role), { replace: true })
      })
      .catch((error: unknown) => {
        const apiError = toApiError(error)
        if (apiError.code === 'EMAIL_NOT_VERIFIED' || apiError.code.startsWith('VERIFICATION_')) {
          verification.reset()
        }
        setFeedback(verificationErrorMessage(apiError))
      })
      .finally(() => setSubmitting(false))
  }

  return {
    ...verification,
    emailVerified: verification.verified,
    pending: verification.pending || submitting,
    feedback,
    resetVerification,
    finishSignup,
  }
}
