import type { FormEvent } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import dice from '../../../assets/student/nickname-random.svg'
import qrDice from '../../../assets/student/nickname-random-qr.svg'
import StudentHeader from '../components/StudentHeader'
import StudentReviewSetList from '../components/StudentReviewSetList'
import { reviewSets } from '../data/studentFixtures'
import { useStudentJoin } from '../hooks/useStudentJoin'
import './StudentJoin.css'

export default function StudentJoin() {
  const params = useParams()
  const [search] = useSearchParams()
  const location = useLocation()
  const qrCode = params.code ?? search.get('code') ?? ''
  return <StudentJoinForm key={location.key} qrCode={qrCode} />
}

function StudentJoinForm({ qrCode }: { qrCode: string }) {
  const fromQr = Boolean(qrCode)
  const { code, setCode, nickname, setNickname, room, pending, error, setError, enter, randomizeNickname } = useStudentJoin(qrCode)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void enter()
  }

  return (
    <div className="student-app">
      <StudentHeader />
      <main className="student-join">
        <form className="student-join__card student-card" onSubmit={submit} aria-busy={pending}>
          <h1>수업 입장</h1>
          <p className="student-join__intro">{room ? `${room.title} · ${room.ownerName} 수업에 입장합니다` : 'QR로 들어오면 입장 코드는 자동으로 채워집니다'}</p>
          {fromQr || room ? (
            <div className="student-join__qr-code"><strong>{code}</strong><span>{fromQr ? '(QR로 자동 입력됨)' : '(코드 확인 완료)'}</span></div>
          ) : (
            <><label className="student-visually-hidden" htmlFor="join-code">입장 코드 6자리</label>
              <input id="join-code" className="student-join__code" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="입장 코드 6자리" value={code} disabled={pending} aria-invalid={Boolean(error)} aria-describedby={error ? 'join-error' : undefined} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} />
            </>
          )}
          {room && <><label className="student-join__label" htmlFor="nickname">닉네임 (이 수업에서만 쓰는 이름)</label>
          <div className="student-join__nickname-row">
            <input id="nickname" maxLength={10} value={nickname} disabled={pending} aria-invalid={Boolean(error)} aria-describedby={error ? 'join-error' : undefined} onChange={event => { setNickname(event.target.value); setError('') }} />
            <button className="student-join__random" type="button" disabled={pending} onClick={randomizeNickname}><img src={fromQr ? qrDice : dice} alt="" />다른 이름</button>
          </div>
          <p className="student-join__hint">추천 이름을 그대로 쓰거나 바꿔도 됩니다 (2~10자) · 재입장 시에는 기존 이름을 사용합니다.</p></>}
          {pending && <p role="status" className="student-join__hint">{room ? '수업에 입장하는 중입니다.' : '수업을 확인하는 중입니다.'}</p>}
          {error && <p id="join-error" role="alert" className="student-join__error">{error}</p>}
          <button className="student-button student-button--primary student-join__submit" type="submit" disabled={pending}>{pending ? '처리 중…' : room ? '입장' : '코드 확인'}</button>
          {(error || room) && <Link to="/student" className="student-button student-join__home">홈으로</Link>}
        </form>
        {!fromQr && <StudentReviewSetList sets={reviewSets} />}
      </main>
    </div>
  )
}
