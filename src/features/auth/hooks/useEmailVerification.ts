import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { toApiError } from '../api'
import type { ApiError } from '../api'

/** 입력칸 바로 아래에 보이는 안내. error는 빨강, 나머지는 초록으로 표시한다. */
export interface FieldMessage {
  text: string
  tone: 'success' | 'error'
}

/** 서버 EmailVerificationService.RESEND_INTERVAL과 같은 값(#109). */
export const RESEND_SECONDS = 30

/** 05 API 명세 5절 인증 관련 에러 코드별 안내. 없으면 서버 message를 그대로 쓴다. */
export function verificationErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'VALIDATION_FAILED':
      return error.fieldErrors?.[0]?.message ?? error.message
    case 'EMAIL_ALREADY_EXISTS':
      return '이미 가입된 이메일입니다. 로그인해 주세요.'
    case 'VERIFICATION_TOO_FREQUENT':
      return `인증 코드는 ${RESEND_SECONDS}초에 한 번 보낼 수 있습니다. 잠시 후 다시 요청해 주세요.`
    case 'VERIFICATION_NOT_FOUND':
    case 'VERIFICATION_CODE_EXPIRED':
      return '인증 코드가 만료되었습니다. 인증요청을 다시 눌러 주세요.'
    case 'EMAIL_NOT_VERIFIED':
      return '이메일 인증이 유효하지 않습니다. 인증요청을 다시 눌러 주세요.'
    // VERIFICATION_CODE_INVALID는 서버 message에 남은 시도 횟수가 들어 있다.
    default:
      return error.message
  }
}

/**
 * 이메일 인증 코드 발송·확인 상태. 발송 결과는 이메일 칸 아래, 확인 결과는 인증 코드 칸 아래에 보인다.
 * 발송·확인 API를 받아 회원가입과 비밀번호 찾기(#108)가 같이 쓴다.
 */
export function useEmailVerification({ email, code, sendCode, confirmCode, sentMessage }: {
  email: string
  code: string
  sendCode: (email: string) => Promise<void>
  confirmCode: (email: string, code: string) => Promise<void>
  sentMessage: string
}) {
  const [requestedEmail, setRequestedEmail] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [emailMessage, setEmailMessage] = useState<FieldMessage | null>(null)
  const [codeMessage, setCodeMessage] = useState<FieldMessage | null>(null)
  const [pending, setPending] = useState(false)
  // 재요청까지 남은 초. 서버도 같은 간격을 검사하므로 화면 표시용이다.
  const [cooldown, setCooldown] = useState(0)
  const normalizedEmail = email.trim().toLowerCase()
  const verified = normalizedEmail !== '' && verifiedEmail === normalizedEmail
  const requested = requestedEmail !== '' && requestedEmail === normalizedEmail
  const canVerify = requested && !verified

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((left) => left - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  function reset() {
    setRequestedEmail('')
    setVerifiedEmail('')
    setEmailMessage(null)
    setCodeMessage(null)
    setCooldown(0)
  }

  async function run(task: () => Promise<void>, onError: (message: FieldMessage) => void) {
    setPending(true)
    try {
      await task()
    } catch (error) {
      onError({ text: verificationErrorMessage(toApiError(error)), tone: 'error' })
    } finally {
      setPending(false)
    }
  }

  function requestCode(event: MouseEvent<HTMLButtonElement>) {
    const emailInput = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="email"]')
    if (!emailInput?.reportValidity()) return
    void run(async () => {
      await sendCode(normalizedEmail)
      setRequestedEmail(normalizedEmail)
      setVerifiedEmail('')
      setEmailMessage({ text: sentMessage, tone: 'success' })
      setCodeMessage(null)
      setCooldown(RESEND_SECONDS)
    }, setEmailMessage)
  }

  function verifyCode() {
    if (!canVerify) {
      setCodeMessage({ text: '현재 이메일로 인증요청을 먼저 눌러 주세요.', tone: 'error' })
      return
    }
    if (!/^\d{6}$/.test(code)) {
      setCodeMessage({ text: '인증 코드 6자리를 입력해 주세요.', tone: 'error' })
      return
    }
    void run(async () => {
      await confirmCode(normalizedEmail, code)
      setVerifiedEmail(normalizedEmail)
      // 발송 안내는 지우고 완료 안내만 남긴다. 인증이 끝나면 이메일 칸도 잠긴다.
      setEmailMessage(null)
      setCodeMessage({ text: '이메일 인증이 완료되었습니다.', tone: 'success' })
    }, setCodeMessage)
  }

  return {
    normalizedEmail, verified, requested, canVerify, pending, cooldown,
    emailMessage, codeMessage, reset, requestCode, verifyCode,
  }
}
