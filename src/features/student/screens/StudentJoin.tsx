import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import dice from '../../../assets/student/nickname-random.svg'
import qrDice from '../../../assets/student/nickname-random-qr.svg'
import StudentHeader from '../components/StudentHeader'
import StudentReviewSetList from '../components/StudentReviewSetList'
import { classTitle, reviewSets } from '../data/studentFixtures'
import { readSession, writeSession } from '../data/studentStorage'
import './StudentJoin.css'

const nicknames = ['조용한 판다몽', '부지런한 수박', '느긋한 참외', '용감한 자두', '행복한 고양이', '씩씩한 복숭아']

export default function StudentJoin() {
  const params = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const qrCode = params.code ?? search.get('code') ?? ''
  const fromQr = Boolean(qrCode)
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState(nicknames[0])
  const [error, setError] = useState('')
  const previousSession = readSession()
  if (fromQr && previousSession?.code === qrCode) {
    return <Navigate to={`/student/room/${qrCode}`} state={previousSession} replace />
  }

  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entryCode = fromQr ? qrCode : code
    if (!/^\d{6}$/.test(entryCode)) { setError('입장 코드를 숫자 6자리로 입력해 주세요.'); return }
    if (nickname.trim().length < 2 || nickname.trim().length > 10) { setError('닉네임은 2~10자로 입력해 주세요.'); return }
    const session = { code: entryCode, nickname: nickname.trim() }
    writeSession(session)
    navigate(`/student/room/${entryCode}`, { state: session })
  }

  function changeNickname() {
    const choices = nicknames.filter(value => value !== nickname)
    setNickname(choices[Math.floor(Math.random() * choices.length)])
    setError('')
  }

  return (
    <div className="student-app">
      <StudentHeader />
      <main className="student-join">
        <form className="student-join__card student-card" onSubmit={enter}>
          <h1>수업 입장</h1>
          <p className="student-join__intro">{fromQr ? `${classTitle} 수업에 입장합니다` : 'QR로 들어오면 입장 코드는 자동으로 채워집니다'}</p>
          {fromQr ? (
            <div className="student-join__qr-code"><strong>{qrCode}</strong><span>(QR로 자동 입력됨)</span></div>
          ) : (
            <><label className="student-visually-hidden" htmlFor="join-code">입장 코드 6자리</label>
              <input id="join-code" className="student-join__code" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="입장 코드 6자리" value={code} aria-invalid={Boolean(error)} aria-describedby={error ? 'join-error' : undefined} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} />
            </>
          )}
          <label className="student-join__label" htmlFor="nickname">닉네임 (이 수업에서만 쓰는 이름)</label>
          <div className="student-join__nickname-row">
            <input id="nickname" maxLength={10} value={nickname} onChange={event => { setNickname(event.target.value); setError('') }} />
            <button className="student-join__random" type="button" onClick={changeNickname}><img src={fromQr ? qrDice : dice} alt="" />다른 이름</button>
          </div>
          <p className="student-join__hint">{fromQr ? '이미 이 수업에 들어온 적이 있으면 이 화면 없이 바로 수업으로 이동합니다.' : '랜덤 이름이 채팅에 표시됩니다 · 그대로 써도 되고 바꿔도 됩니다 (2~10자)'}</p>
          {error && <p id="join-error" role="alert" className="student-join__error">{error}</p>}
          <button className="student-button student-button--primary student-join__submit" type="submit">입장</button>
        </form>
        {!fromQr && <StudentReviewSetList sets={reviewSets} />}
      </main>
    </div>
  )
}
