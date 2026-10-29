import { useState } from 'react'
import type { ChangeEvent, ComponentProps, CompositionEvent, Dispatch, SetStateAction } from 'react'
import { hangulToQwerty } from '../../../shared/utils/hangulToQwerty'
import './PasswordInput.css'

function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  )
}

export function PasswordInput({ onValueChange, ...props }: Omit<ComponentProps<'input'>, 'type' | 'className' | 'value' | 'onChange'> & {
  value: string
  onValueChange: Dispatch<SetStateAction<string>>
}) {
  const [visible, setVisible] = useState(false)

  // 조합 중에는 IME 값을 유지하고 조합이 끝난 뒤 두벌식 영문으로 변환한다.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const composing = (event.nativeEvent as InputEvent).isComposing
    onValueChange(composing ? event.target.value : hangulToQwerty(event.target.value))
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    onValueChange(hangulToQwerty(event.currentTarget.value))
  }

  return (
    <div className="auth-password">
      <input placeholder="******" required {...props} onChange={handleChange} onCompositionEnd={handleCompositionEnd} type={visible ? 'text' : 'password'} className="auth-input auth-input--with-toggle" />
      <button type="button" onClick={() => setVisible(previous => !previous)} aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'} aria-pressed={visible} className="auth-toggle">
        <EyeIcon off={visible} />
      </button>
    </div>
  )
}
