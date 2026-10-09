import { Link } from 'react-router-dom'
import logo from '../../../assets/student/brand-mark.svg'
import chevron from '../../../assets/student/chevron-down.svg'
import './StudentHeader.css'

interface Props {
  title?: string
  nickname?: string
  onLeave?: () => void
}

export default function StudentHeader({ title, nickname, onLeave }: Props) {
  return (
    <header className={`student-header ${title ? 'student-header--room' : ''}`}>
      <div className="student-header__inner">
        <Link className="student-header__brand" to="/student" aria-label="삼훗 학생 홈">
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
            <summary><span className="student-header__avatar">김</span>김상윤<img src={chevron} alt="" /></summary>
            <div className="student-header__account-menu"><p>김상윤</p><span className="student-muted">학생 계정</span></div>
          </details>
        )}
      </div>
    </header>
  )
}
