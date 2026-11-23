import type { AuthRole } from '../auth.types'
import './AuthPreviewPanel.css'

type Props = { mode: 'login'; role: AuthRole; onRoleChange: (role: AuthRole) => void }

export function AuthPreviewPanel(props: Props) {
  if (!import.meta.env.DEV) return null

  return (
    <aside className="auth-preview" aria-label="로컬 빠른 로그인">
      <p className="auth-preview__title">로컬 빠른 로그인</p>
      <p>이메일을 비워 두고 역할을 선택한 뒤 로그인 버튼을 누르면 로컬 테스트 계정으로 로그인해요(.env.local 설정 필요). 설정이 없거나 백엔드가 꺼져 있으면 화면 미리보기로 들어가요.</p>
      <fieldset className="auth-preview__roles">
        <legend>로그인 역할</legend>
        {(['PROFESSOR', 'STUDENT'] as const).map(role => (
          <label key={role}>
            <input type="radio" name="preview-role" checked={props.role === role} onChange={() => props.onRoleChange(role)} />
            {role === 'PROFESSOR' ? '교수' : '학생'}
          </label>
        ))}
      </fieldset>
    </aside>
  )
}
