import './ProfessorRoom.css'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { ProfessorQuizState } from '../../quiz/professorQuizReducer'
import type { Room, ChatMessage } from '../dashboard-types'
import { Icon } from '../components/Icon'
import { RoomSetPicker } from '../components/RoomSetPicker'
import { QuizQuestion } from '../components/QuizQuestion'
import { JoinCode } from '../components/JoinCode'
import { Reactions } from '../components/Reactions'
import { Chat } from '../components/Chat'
import { Modal } from '../components/Modal'

export function ProfessorRoom({
  room,
  quiz,
  quizReady,
  onStartQuiz,
  onStopQuiz,
  messages,
  onSend,
  notice,
  onNoticeChange,
}: {
  room: Room
  quiz: ProfessorQuizState
  quizReady: boolean
  onStartQuiz: (questionSetId: number) => void
  onStopQuiz: () => void
  messages: ChatMessage[]
  onSend: (text: string, reply?: string) => void
  notice: string
  onNoticeChange: (notice: string) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [stopping, setStopping] = useState(false)
  const waiting = quiz.phase === 'waiting'
  // 다른 탭의 시작·중단처럼 서버 메시지로 단계가 바뀌면, 이전 단계의 창은 더 이상 쓸 수 없다.
  useEffect(() => {
    setChoosing(false)
    setStopping(false)
  }, [waiting])
  if (!room.active) return <Navigate to="/professor" replace />
  if (quiz.phase === 'results') return <Navigate to="/professor/room/results" replace />
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
                세트를 골라 시작하면 1번부터 자동 진행 · 제한시간은 문항별 설정값
              </p>
              <button
                type="button"
                onClick={() => setChoosing(true)}
                disabled={!quizReady}
                className="professor-room__start-button"
              >
                <Icon screen="waiting" name="imgFrame3" />
                퀴즈 시작
              </button>
              <p className="professor-room__set-help">
                {quizReady
                  ? '누르면 세트 선택 창이 열립니다 · 한 수업에서 여러 번 가능'
                  : '서버의 수업에 연결되면 시작할 수 있습니다'}
              </p>
            </section>
          </>
        ) : (
          <QuizQuestion
            quiz={quiz}
            participants={room.participants}
            onStop={() => setStopping(true)}
          />
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
          {/* 목록·빈 세트·조회 실패 처리는 #63의 선택 창을 그대로 쓰고, 고른 세트 ID로 서버에 시작을 요청한다. */}
          <RoomSetPicker
            onSelect={(selected) => {
              onStartQuiz(selected.id)
              setChoosing(false)
            }}
          />
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
                onStopQuiz()
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
