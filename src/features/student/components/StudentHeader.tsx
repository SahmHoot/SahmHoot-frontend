import { Link } from 'react-router-dom'
import logo from '../../../assets/student/brand-mark.svg'
import chevron from '../../../assets/student/chevron-down.svg'
import { useAuth } from '../../auth/AuthProvider'
import './StudentHeader.css'

interface Props {
  title?: string
  nickname?: string
  onLeave?: () => void
}

export default function StudentHeader({ title, nickname, onLeave }: Props) {
  const { user, signOut } = useAuth()
  // 개발용 화면 미리보기에는 로그인 사용자가 없어서 시안의 이름을 보여 준다.
  const displayName = user?.name ?? '김상윤'
  return (
    <header className={`student-header ${title ? 'student-header--room' : ''}`}>
      <div className="student-header__inner">
        <Link className="student-header__brand" to="/student" aria-label="삼훗 학생 홈" onClick={event => {
          if (onLeave && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault()
            onLeave()
          }
        }}>
          <span className="student-header__logo"><img src={logo} alt="" /></span>
          {title ? <h1>{title}</h1> : <span className="student-header__wordmark">삼훗 <b>SahmHoot</b></span>}
        </Link>
        {title ? (
          <div className="student-header__participation">
            <p><strong>{nickname}</strong><span className="student-muted">으로 참여 중</span></p>
            <button className="student-button" onClick={onLeave}>나가기</button>
          </div>
        ) : (
          <details className="student-header__account">
            <summary><span className="student-header__avatar">{Array.from(displayName)[0]}</span>{displayName}<img src={chevron} alt="" /></summary>
            <div className="student-header__account-menu">
              <p>{displayName}</p><span className="student-muted">학생 계정</span>
              <button type="button" onClick={signOut}>로그아웃</button>
            </div>
          </details>
        )}
      </div>
    </header>
  )
}
