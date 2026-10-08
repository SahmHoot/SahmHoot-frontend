import './ProfessorHome.css'
import { Link } from 'react-router-dom'
import type { Room } from '../dashboard-types'
import { Icon } from '../components/Icon'

export function ProfessorHome({ room }: { room: Room }) {
  return (
    <main className="professor-home">
      <div className="professor-home__heading-row">
        <h1 className="professor-home__title">내 수업</h1>
        <Link to="/professor/create" className="professor-home__create-button">
          <Icon screen="home" name="imgFrame2" />
          수업 방 개설
        </Link>
      </div>
      <h2 className="professor-home__section-title">진행 중</h2>
      {room.active ? (
        <article className="professor-home__room-card">
          <span className="professor-home__room-accent" />
          <div>
            <h3 className="professor-home__room-title">
              <span className="professor-home__status-dot" />
              <span className="professor-home__status-label">진행 중</span>
              <span className="professor-home__separator">·</span>
              {room.name}
            </h3>
            <p className="professor-home__room-meta">
              <span>
                입장 코드 <strong className="professor-home__join-code">{room.code}</strong>
              </span>
              <span>·</span>
              <span className="professor-home__participants">
                <Icon screen="home" name="imgFrame3" />
                접속 {room.participants}명
              </span>
            </p>
          </div>
          <Link to="/professor/room" className="professor-home__open-button">
            수업 화면 열기
            <Icon screen="home" name="imgFrame4" />
          </Link>
        </article>
      ) : (
        <div className="professor-home__empty">
          진행 중인 수업이 없습니다. 수업 방을 개설해 주세요.
        </div>
      )}
      <Link to="/professor/sets" className="professor-home__sets-button">
        <Icon screen="home" name="imgFrame5" />
        문제 세트 관리
      </Link>
    </main>
  )
}
