import { useEffect, useRef, useState } from 'react'
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
export function useEmailVerification({ email, code, sendCode, confirmCode, sentMessage, onSent, onVerified }: {
  email: string
  code: string
  sendCode: (email: string) => Promise<void>
  confirmCode: (email: string, code: string) => Promise<void>
  sentMessage: string
  /** 발송에 성공했을 때. 서버가 이전 코드를 새 코드로 바꾸므로 입력한 이전 코드를 지우는 데 쓴다. */
  onSent?: () => void
  /** 확인에 성공했을 때. 가입·변경 버튼 아래에 남은 "인증을 먼저" 같은 안내를 지우는 데 쓴다. */
  onVerified?: () => void
}) {
  const [requestedEmail, setRequestedEmail] = useState('')
  const [verifiedEmail, setVerifiedEmail] = useState('')
  const [emailMessage, setEmailMessage] = useState<FieldMessage | null>(null)
  const [codeMessage, setCodeMessage] = useState<FieldMessage | null>(null)
  const [pending, setPending] = useState(false)
  // 재요청 가능 시각(ms). 탭이 백그라운드에서 타이머가 늦게 돌아도 남은 시간은 현재 시각으로 다시 계산한다.
  // 서버는 코드를 만든 시각부터 세므로 요청을 보낸 시각을 기준으로 한다. 서버도 같은 간격을 검사하므로 화면 표시용이다.
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  // reset 때마다 올린다. 이메일을 바꾸기 전에 보낸 요청의 응답은 버린다.
  const generation = useRef(0)
  const normalizedEmail = email.trim().toLowerCase()
  const verified = normalizedEmail !== '' && verifiedEmail === normalizedEmail
  const requested = requestedEmail !== '' && requestedEmail === normalizedEmail
  const canVerify = requested && !verified
  const cooldown = Math.max(0, Math.ceil((resendAt - now) / 1000))

  useEffect(() => {
    if (resendAt <= now) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(1000, resendAt - now))
    return () => clearTimeout(timer)
  }, [resendAt, now])

  function reset() {
    generation.current += 1
    setRequestedEmail('')
    setVerifiedEmail('')
    setEmailMessage(null)
    setCodeMessage(null)
    setResendAt(0)
    setPending(false)
  }

  async function run(task: () => Promise<void>, onSuccess: () => void, onError: (message: FieldMessage) => void) {
    const started = generation.current
    setPending(true)
    try {
      await task()
      if (generation.current === started) onSuccess()
    } catch (error) {
      if (generation.current === started) onError({ text: verificationErrorMessage(toApiError(error)), tone: 'error' })
    } finally {
      if (generation.current === started) setPending(false)
    }
  }

  function requestCode(event: MouseEvent<HTMLButtonElement>) {
    const emailInput = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="email"]')
    if (!emailInput?.reportValidity()) return
    const target = normalizedEmail
    const sentAt = Date.now()
    void run(() => sendCode(target), () => {
      setRequestedEmail(target)
      setVerifiedEmail('')
      setEmailMessage({ text: sentMessage, tone: 'success' })
      setCodeMessage(null)
      setResendAt(sentAt + RESEND_SECONDS * 1000)
      setNow(Date.now())
      onSent?.()
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
    const target = normalizedEmail
    void run(() => confirmCode(target, code), () => {
      setVerifiedEmail(target)
      // 발송 안내는 지우고 완료 안내만 남긴다. 인증이 끝나면 이메일 칸도 잠긴다.
      setEmailMessage(null)
      setCodeMessage({ text: '이메일 인증이 완료되었습니다.', tone: 'success' })
      onVerified?.()
    }, setCodeMessage)
  }

  return {
    normalizedEmail, verified, requested, canVerify, pending, cooldown,
    emailMessage, codeMessage, reset, requestCode, verifyCode,
  }
}
