import type { AuthRole } from '../auth.types'
import './AuthPreviewPanel.css'

type Props =
  | { mode: 'signup' }
  | { mode: 'login'; role: AuthRole; onRoleChange: (role: AuthRole) => void }

export function AuthPreviewPanel(props: Props) {
  if (!import.meta.env.DEV) return null

  return (
    <aside className="auth-preview" aria-label="화면 미리보기">
      <p className="auth-preview__title">화면 미리보기 모드</p>
      {props.mode === 'login' ? (
        <>
          <p>계정 입력 없이 역할을 선택하고 로그인 버튼을 누르면 해당 화면으로 이동해요.</p>
          <fieldset className="auth-preview__roles">
            <legend>미리보기 역할</legend>
            {(['PROFESSOR', 'STUDENT'] as const).map(role => (
              <label key={role}>
                <input type="radio" name="preview-role" checked={props.role === role} onChange={() => props.onRoleChange(role)} />
                {role === 'PROFESSOR' ? '교수' : '학생'}
              </label>
            ))}
          </fieldset>
        </>
      ) : (
        <p>실제 계정은 생성되지 않아요. 인증요청 후 미리보기 인증번호 <strong>000000</strong>으로 가입 흐름을 확인하세요.</p>
      )}
    </aside>
  )
}
