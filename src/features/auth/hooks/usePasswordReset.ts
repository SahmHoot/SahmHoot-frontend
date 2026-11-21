import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmPasswordResetCode, resetPassword, sendPasswordResetCode, toApiError } from '../api'
import { useEmailVerification, verificationErrorMessage } from './useEmailVerification'

/** 로그인 화면이 비밀번호 변경 직후 보여 줄 안내. location.state.notice로 넘긴다. */
export const PASSWORD_RESET_NOTICE = '비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.'

/** 비밀번호 찾기(#108): 이메일 인증 → 새 비밀번호 저장 → 로그인 화면. */
export function usePasswordReset({ email, code }: { email: string; code: string }) {
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState('')
  const verification = useEmailVerification({
    email, code,
    sendCode: sendPasswordResetCode,
    confirmCode: confirmPasswordResetCode,
    // 서버는 가입 여부와 관계없이 같은 응답을 준다. 안내도 가입 여부를 단정하지 않는다.
    sentMessage: '가입된 이메일이면 인증 코드를 보냈습니다. 메일함을 확인해 주세요. 코드는 10분간 유효합니다.',
    onVerified: () => setFeedback(''),
  })
  const [submitting, setSubmitting] = useState(false)

  function resetVerification() {
    verification.reset()
    setFeedback('')
  }

  function finish(newPassword: string) {
    if (!verification.verified) {
      setFeedback('이메일 인증을 먼저 완료해 주세요.')
      return
    }
    setSubmitting(true)
    resetPassword(verification.normalizedEmail, code, newPassword)
      .then(() => navigate('/login', { replace: true, state: { notice: PASSWORD_RESET_NOTICE } }))
      .catch((error: unknown) => {
        const apiError = toApiError(error)
        if (apiError.code === 'EMAIL_NOT_VERIFIED' || apiError.code.startsWith('VERIFICATION_')) {
          verification.reset()
        }
        setFeedback(verificationErrorMessage(apiError))
        setSubmitting(false)
      })
  }

  return {
    ...verification,
    pending: verification.pending || submitting,
    feedback,
    resetVerification,
    finish,
  }
}
