import './QuizResults.css'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { QuizResult } from '../../quiz/types'
import type { Room, ChatMessage } from '../dashboard-types'
import { choiceLabel, percentagesOf } from '../dashboard-quiz'
import { Icon } from '../components/Icon'
import { JoinCode } from '../components/JoinCode'
import { Chat } from '../components/Chat'

export function QuizResults({
  room,
  result,
  messages,
  onSend,
  onClose,
  notice,
  onNoticeChange,
}: {
  room: Room
  result: QuizResult | null
  messages: ChatMessage[]
  onSend: (text: string, reply?: string) => void
  onClose: () => void
  notice: string
  onNoticeChange: (notice: string) => void
}) {
  const [index, setIndex] = useState(0)
  const question = result?.questions[index]
  if (!room.active || !result || !question) return <Navigate to="/professor/room" replace />
  const { questions } = result
  const percentages = percentagesOf(question.choices.map((choice) => choice.count))
  // 06 4절: 정답률 = correctCount ÷ answeredCount. 응답이 없으면 0%로 표시한다.
  const accuracy = question.answeredCount
    ? Math.round((question.correctCount / question.answeredCount) * 100)
    : 0
  return (
    <main className="quiz-results">
      <div className="quiz-results__content">
        <JoinCode room={room} variant="results" />
        <section className="quiz-results__question-panel">
          <div className="quiz-results__question-toolbar">
            <p className="quiz-results__question-counter">
              퀴즈 결과 ·{' '}
              <span className="quiz-results__current-question">
                {index + 1} / {questions.length} 문항
              </span>{' '}
              보는 중
            </p>
            <div className="quiz-results__actions">
              <button type="button" onClick={onClose} className="quiz-results__close-button">
                결과 닫기
              </button>
              <button
                type="button"
                onClick={() => setIndex((index + 1) % questions.length)}
                className="quiz-results__next-button"
              >
                {index === questions.length - 1 ? '첫 문항 결과' : '다음 문항 결과'}
                <Icon screen="results" name="imgFrame3" />
              </button>
            </div>
          </div>
          <h2 className="quiz-results__question-title">{question.content}</h2>
        </section>
        <section className="quiz-results__distribution-panel">
          <div className="quiz-results__summary-row">
            <p className="quiz-results__summary">
              응답 {question.answeredCount}명 ·{' '}
              <span className="quiz-results__correct-count">정답 {question.correctCount}명</span> ·{' '}
              <span className="quiz-results__incorrect-count">오답 {question.incorrectCount}명</span>{' '}
              · <span className="quiz-results__accuracy">정답률 {accuracy}%</span>
            </p>
            <span className="quiz-results__summary-help">점수·순위 없음 — 이해도 확인용</span>
          </div>
          <ul className="quiz-results__options">
            {question.choices.map((choice, choiceIndex) => {
              const correct = choice.id === question.correctChoiceId
              return (
                <li key={choice.id} className="quiz-results__option">
                  <span
                    className={`quiz-results__option-label ${correct ? 'quiz-results__option-label--correct' : ''}`}
                  >
                    <span className="quiz-results__option-number">
                      {choiceLabel(choice, question.choices.length)}
                    </span>
                    {choice.content}
                  </span>
                  <div
                    role="meter"
                    aria-label={`${choice.content} 응답 비율`}
                    aria-valuenow={percentages[choiceIndex]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="quiz-results__meter"
                  >
                    <div
                      className="quiz-results__meter-fill"
                      data-correct={correct}
                      data-wrong-index={
                        question.choices
                          .slice(0, choiceIndex)
                          .filter(({ id }) => id !== question.correctChoiceId).length
                      }
                      style={{
                        width: `${percentages[choiceIndex]}%`,
                      }}
                    />
                  </div>
                  <span
                    className={`quiz-results__percentage ${correct ? 'quiz-results__percentage--correct' : ''}`}
                  >
                    {percentages[choiceIndex]}%
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="quiz-results__help">정답은 굵게 · 개인별 정답 여부는 표시하지 않음</p>
        </section>
      </div>
      <Chat
        notice={notice}
        onNoticeChange={onNoticeChange}
        compact
        screen="results"
        messages={messages}
        onSend={onSend}
        participants={room.participants}
      />
    </main>
  )
}
