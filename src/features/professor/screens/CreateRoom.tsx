import './CreateRoom.css'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Room } from '../dashboard-types'
import { demoRoom } from '../dashboard-data'
import { JoinCode } from '../components/JoinCode'

export function CreateRoom({ room, onCreate }: { room: Room; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  const [created, setCreated] = useState(false)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    onCreate(name.trim())
    setCreated(true)
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
            setCreated(false)
          }}
          required
          maxLength={80}
          placeholder="예: 자료구조 3주차"
          className="create-room__name-input"
        />
        <div className="create-room__actions">
          <button type="submit" className="create-room__create-button">
            개설하기
          </button>
          {created && (
            <Link to="/professor/room" className="create-room__open-button">
              수업 화면 열기
            </Link>
          )}
        </div>
      </form>
      <JoinCode room={created ? room : demoRoom} variant="create" completed={created} />
      {created && (
        <p role="status" className="create-room__feedback">
          {room.name} 수업 방이 개설되었습니다. 예시 입장 코드로 화면을 확인할 수 있습니다.
        </p>
      )}
    </main>
  )
}
