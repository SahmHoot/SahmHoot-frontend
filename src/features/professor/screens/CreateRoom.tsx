import './CreateRoom.css'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toApiError } from '../../auth/api'
import type { Room } from '../dashboard-types'
import { noRoom } from '../dashboard-data'
import { JoinCode } from '../components/JoinCode'

export function CreateRoom({
  room,
  onCreate,
}: {
  room: Room
  onCreate: (title: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  // 개설한 수업명. 입력값이 그대로면 개설 완료 상태를 유지해 같은 방을 다시 만들지 않는다.
  const [createdTitle, setCreatedTitle] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const created = createdTitle !== null && name.trim() === createdTitle
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = name.trim()
    if (submitting || created) return
    if (!title) {
      setError('수업명을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onCreate(title)
      setCreatedTitle(title)
    } catch (failure) {
      const apiError = toApiError(failure)
      setError(apiError.fieldErrors?.[0]?.message ?? apiError.message)
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <main className="create-room">
      <h1 className="create-room__title">수업 방 개설</h1>
      <form onSubmit={submit} className="create-room__form">
        <label htmlFor="class-name" className="create-room__label">
          수업명
        </label>
        <input
          id="class-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setError('')
          }}
          required
          disabled={submitting}
          maxLength={50}
          placeholder="예: 자료구조 3주차"
          aria-invalid={error !== ''}
          aria-describedby={error ? 'class-name-error' : undefined}
          className="create-room__name-input"
        />
        {error && (
          <p id="class-name-error" role="alert" className="create-room__error">
            {error}
          </p>
        )}
        <div className="create-room__actions">
          <button type="submit" disabled={submitting || created} className="create-room__create-button">
            {submitting ? '개설하는 중…' : '개설하기'}
          </button>
          {created && (
            <Link to="/professor/room" className="create-room__open-button">
              수업 화면 열기
            </Link>
          )}
          <Link to="/professor" className="create-room__cancel-button">
            {created ? '교수 홈으로' : '취소'}
          </Link>
        </div>
      </form>
      <JoinCode room={created ? room : noRoom} variant="create" completed={created} />
      {created && (
        <p role="status" className="create-room__feedback">
          {room.name} 수업 방이 개설되었습니다. 학생에게 입장 코드를 안내해 주세요.
        </p>
      )}
    </main>
  )
}
