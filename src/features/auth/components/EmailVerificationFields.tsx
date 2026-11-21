import type { MouseEvent } from 'react'
import type { FieldMessage } from '../hooks/useEmailVerification'

function Message({ id, message }: { id: string; message: FieldMessage | null }) {
  if (!message) return null
  const error = message.tone === 'error'
  return (
    <p id={id} role={error ? 'alert' : 'status'} className={error ? 'auth-error' : 'auth-success'}>
      {message.text}
    </p>
  )
}

/**
 * 이메일 + 인증요청, 인증코드 + 확인 두 줄. 회원가입과 비밀번호 찾기(#108)가 같이 쓴다(#109).
 * 인증이 끝나면 두 칸과 버튼을 비활성으로 바꿔 같은 이메일로만 다음 단계를 진행하게 한다.
 */
export function EmailVerificationFields({ email, code, onEmailChange, onCodeChange, verification }: {
  email: string
  code: string
  /** 이메일이 바뀌면 호출한 쪽에서 코드와 인증 상태를 지운다. */
  onEmailChange: (value: string) => void
  onCodeChange: (value: string) => void
  verification: {
    verified: boolean
    requested: boolean
    canVerify: boolean
    pending: boolean
    cooldown: number
    emailMessage: FieldMessage | null
    codeMessage: FieldMessage | null
    requestCode: (event: MouseEvent<HTMLButtonElement>) => void
    verifyCode: () => void
  }
}) {
  const { verified, requested, canVerify, pending, cooldown, emailMessage, codeMessage } = verification
  const requestLabel = cooldown > 0 ? `${cooldown}초` : requested ? '재요청' : '인증요청'

  return (
    <>
      <div className="auth-field">
        <label htmlFor="email" className="auth-label">이메일</label>
        <div className="auth-input-row">
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="example@syu.ac.kr"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            disabled={verified}
            aria-describedby={emailMessage ? 'email-message' : undefined}
            aria-invalid={emailMessage?.tone === 'error'}
            className="auth-input"
            required
          />
          <button
            type="button"
            className="auth-btn-side"
            onClick={verification.requestCode}
            disabled={pending || verified || cooldown > 0}
            aria-label={cooldown > 0 ? `${cooldown}초 뒤 다시 요청할 수 있습니다` : undefined}
          >
            {requestLabel}
          </button>
        </div>
        <Message id="email-message" message={emailMessage} />
      </div>

      <div className="auth-field">
        <label htmlFor="code" className="auth-label">인증코드</label>
        <div className="auth-input-row">
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            readOnly={pending}
            disabled={verified}
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
            value={code}
            onChange={(e) => onCodeChange(e.target.value.replace(/\D/g, ''))}
            aria-describedby={codeMessage ? 'code-message' : undefined}
            aria-invalid={codeMessage?.tone === 'error'}
            className="auth-input"
            required
          />
          <button
            type="button"
            className="auth-btn-side"
            onClick={verification.verifyCode}
            disabled={pending || !canVerify}
          >
            {verified ? '확인 완료' : '확인'}
          </button>
        </div>
        <Message id="code-message" message={codeMessage} />
      </div>
    </>
  )
}
