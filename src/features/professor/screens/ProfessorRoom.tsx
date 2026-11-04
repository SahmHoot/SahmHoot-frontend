import './ProfessorRoom.css'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { ProfessorQuizState } from '../../quiz/professorQuizReducer'
import type { QuestionSetSummary } from '../../quiz/types'
import type { Room, ChatMessage } from '../dashboard-types'
import { Icon } from '../components/Icon'
import { QuizQuestion } from '../components/QuizQuestion'
import { JoinCode } from '../components/JoinCode'
import { Reactions } from '../components/Reactions'
import { Chat } from '../components/Chat'
import { Modal } from '../components/Modal'

export function ProfessorRoom({
  room,
  quiz,
  quizReady,
  onLoadQuestionSets,
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
  onLoadQuestionSets: () => Promise<QuestionSetSummary[]>
  onStartQuiz: (questionSetId: number) => void
  onStopQuiz: () => void
  messages: ChatMessage[]
  onSend: (text: string, reply?: string) => void
  notice: string
  onNoticeChange: (notice: string) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [stopping, setStopping] = useState(false)
  /** 시작 창의 세트 목록. null이면 불러오는 중이다. */
  const [startableSets, setStartableSets] = useState<QuestionSetSummary[] | null>(null)
  if (!room.active) return <Navigate to="/professor" replace />
  if (quiz.phase === 'results') return <Navigate to="/professor/room/results" replace />
  const waiting = quiz.phase === 'waiting'
  const openSetChooser = () => {
    setChoosing(true)
    setStartableSets(null)
    void onLoadQuestionSets().then((sets) =>
      setStartableSets(sets.filter((set) => set.questionCount > 0)),
    )
  }
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
                onClick={openSetChooser}
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
          <div className="professor-room__set-choices">
            {startableSets === null && (
              <p className="professor-room__empty-message">문제 세트를 불러오는 중입니다.</p>
            )}
            {startableSets?.map((item) => (
              <button
                key={item.id}
                type="button"
                className="professor-room__set-choice"
                onClick={() => {
                  onStartQuiz(item.id)
                  setChoosing(false)
                }}
              >
                <span className="professor-room__choice-name">{item.title}</span>
                <span className="professor-room__choice-meta">{item.questionCount}문항</span>
              </button>
            ))}
            {startableSets?.length === 0 && (
              <>
                <p className="professor-room__empty-message">먼저 문제 세트를 만들어 주세요.</p>
                <Link to="/professor/sets/new" className="professor-room__create-button">
                  새 세트 만들기
                </Link>
              </>
            )}
          </div>
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
