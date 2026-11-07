import './ProfessorRoom.css'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { Room, QuizState, ChatMessage } from '../dashboard-types'
import { initialQuiz, startQuiz } from '../dashboard-quiz'
import { RoomSetPicker } from '../components/RoomSetPicker'
import { Icon } from '../components/Icon'
import { QuizQuestion } from '../components/QuizQuestion'
import { JoinCode } from '../components/JoinCode'
import { Reactions } from '../components/Reactions'
import { Chat } from '../components/Chat'
import { Modal } from '../components/Modal'

export function ProfessorRoom({
  room,
  quiz,
  setQuiz,
  messages,
  onSend,
  notice,
  onNoticeChange,
}: {
  room: Room
  quiz: QuizState
  setQuiz: (quiz: QuizState) => void
  messages: ChatMessage[]
  onSend: (text: string, reply?: string) => void
  notice: string
  onNoticeChange: (notice: string) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [stopping, setStopping] = useState(false)
  if (!room.active) return <Navigate to="/professor" replace />
  if (quiz.phase === 'results') return <Navigate to="/professor/room/results" replace />
  const waiting = quiz.phase === 'waiting'
  const set = quiz.set
  const question = set?.questions[quiz.index]
  return (
    <main
      className={`professor-room ${waiting ? 'professor-room--waiting' : 'professor-room--running'}`}
    >
      <div className="professor-room__content">
        <JoinCode room={room} variant={waiting ? 'waiting' : 'quiz'} />
        {waiting ? (
          <>
            <Reactions participants={room.participants} />
            <section className="professor-room__set-panel">
              <h2 className="professor-room__set-title">문제 세트</h2>
              <p className="professor-room__set-description">
                세트를 골라 시작하면 1번부터 자동 진행 · 각 문항의 제한시간 적용
              </p>
              <button
                type="button"
                onClick={() => setChoosing(true)}
                className="professor-room__start-button"
              >
                <Icon screen="waiting" name="imgFrame3" />
                퀴즈 시작
              </button>
              <p className="professor-room__set-help">
                누르면 세트 선택 창이 열립니다 · 한 수업에서 여러 번 가능
              </p>
            </section>
          </>
        ) : (
          question &&
          set && (
            <QuizQuestion
              quiz={quiz}
              question={question}
              set={set}
              participants={room.participants}
              onStop={() => setStopping(true)}
            />
          )
        )}
      </div>
      <Chat
        notice={notice}
        onNoticeChange={onNoticeChange}
        compact={!waiting}
        screen={waiting ? 'waiting' : 'quiz'}
        messages={messages}
        onSend={onSend}
        participants={room.participants}
      />
      {choosing && (
        <Modal title="출제할 문제 세트 선택" onClose={() => setChoosing(false)}>
          <RoomSetPicker onSelect={(selected) => {
            setQuiz(startQuiz(selected))
            setChoosing(false)
          }} />
        </Modal>
      )}
      {stopping && (
        <Modal title="퀴즈 중단" onClose={() => setStopping(false)}>
          <p className="professor-room__stop-message">
            진행 중인 퀴즈를 중단하고 수업 대기 화면으로 돌아갈까요?
          </p>
          <div className="professor-room__dialog-actions">
            <button
              type="button"
              className="professor-room__continue-button"
              onClick={() => setStopping(false)}
            >
              계속 진행
            </button>
            <button
              type="button"
              className="professor-room__stop-button"
              onClick={() => {
                setQuiz(initialQuiz)
                setStopping(false)
              }}
            >
              퀴즈 중단
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
