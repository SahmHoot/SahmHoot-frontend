import './Header.css'
import { Link, useLocation } from 'react-router-dom'
import type { DesignScreen, Room, QuizState } from '../dashboard-types'
import { Icon } from './Icon'
import { Status } from './Status'

export function Header({ room, quiz, onEnd }: { room: Room; quiz: QuizState; onEnd: () => void }) {
  const { pathname } = useLocation()
  const live = pathname.startsWith('/professor/room')
  const result = pathname.endsWith('/results')
  const screen: DesignScreen = live
    ? result
      ? 'results'
      : quiz.phase === 'waiting'
        ? 'waiting'
        : 'quiz'
    : pathname.includes('/sets/')
      ? 'editor'
      : pathname.endsWith('/sets')
        ? 'sets'
        : pathname.endsWith('/create')
          ? 'create'
          : 'home'
  return (
    <header className="professor-header">
      <div
        className={`professor-header__container ${live ? 'professor-header__container--live' : screen === 'editor' ? 'professor-header__container--editor' : 'professor-header__container--default'}`}
      >
        <div className="professor-header__brand">
          <Link to="/professor" aria-label="삼훗 교수 홈" className="professor-header__home-link">
            <span
              className={`professor-header__logo ${live ? 'professor-header__logo--live' : 'professor-header__logo--default'}`}
            >
              <Icon screen={screen} className="professor-header__logo-icon" />
            </span>
            {!live && (
              <span className="professor-header__brand-name">
                삼훗 <span className="professor-header__brand-english">SahmHoot</span>
              </span>
            )}
          </Link>
          {live && (
            <>
              <h1 className="professor-header__room-title">{room.name}</h1>
              <span className="professor-header__room-status">
                <Status waiting={!result && quiz.phase === 'waiting'} />
              </span>
            </>
          )}
        </div>
        {live ? (
          <div className="professor-header__live-actions">
            <span className="professor-header__participants">
              <Icon screen={screen} name="imgFrame1" />
              접속 {room.participants}명
            </span>
            <button type="button" onClick={onEnd} className="professor-header__end-button">
              수업 종료
            </button>
          </div>
        ) : (
          <details className="professor-header__account">
            <summary className="professor-header__account-toggle">
              <span className="professor-header__avatar">강</span>
              <span>강현민 교수</span>
              <Icon screen={screen} name="imgFrame1" />
            </summary>
            <nav aria-label="교수 메뉴" className="professor-header__menu">
              <Link
                className="professor-header__menu-link"
                to="/professor"
                onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
              >
                내 수업
              </Link>
              <Link
                className="professor-header__menu-link"
                to="/professor/sets"
                onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
              >
                문제 세트 관리
              </Link>
            </nav>
          </details>
        )}
      </div>
    </header>
  )
}
