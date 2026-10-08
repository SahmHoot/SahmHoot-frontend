import './QuizResults.css'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { Room, QuizState, ChatMessage } from '../dashboard-types'
import { exampleResponses, labels } from '../dashboard-quiz'
import { Icon } from '../components/Icon'
import { JoinCode } from '../components/JoinCode'
import { Chat } from '../components/Chat'

export function QuizResults({
  room,
  quiz,
  messages,
  onSend,
  onClose,
}: {
  room: Room
  quiz: QuizState
  messages: ChatMessage[]
  onSend: (text: string, reply?: string) => void
  onClose: () => void
}) {
  const [index, setIndex] = useState(0)
  if (!room.active || !quiz.set || quiz.phase !== 'results')
    return <Navigate to="/professor/room" replace />
  const set = quiz.set
  const question = set.questions[index]
  // Example response distribution; replace with aggregate results from the quiz API.
  const { total, correct, incorrect, percentages } = exampleResponses(room.participants, question)
  const accuracy = total ? Math.round((correct / total) * 100) : 0
  return (
    <main className="quiz-results">
      <div className="quiz-results__content">
        <JoinCode room={room} variant="results" />
        <section className="quiz-results__question-panel">
          <div className="quiz-results__question-toolbar">
            <p className="quiz-results__question-counter">
              퀴즈 결과 ·{' '}
              <span className="quiz-results__current-question">
                {index + 1} / {set.questions.length} 문항
              </span>{' '}
              보는 중
            </p>
            <div className="quiz-results__actions">
              <button type="button" onClick={onClose} className="quiz-results__close-button">
                결과 닫기
              </button>
              <button
                type="button"
                onClick={() => setIndex((index + 1) % set.questions.length)}
                className="quiz-results__next-button"
              >
                {index === set.questions.length - 1 ? '첫 문항 결과' : '다음 문항 결과'}
                <Icon screen="results" name="imgFrame3" />
              </button>
            </div>
          </div>
          <h2 className="quiz-results__question-title">{question.prompt}</h2>
        </section>
        <section className="quiz-results__distribution-panel">
          <div className="quiz-results__summary-row">
            <p className="quiz-results__summary">
              응답 {total}명 · <span className="quiz-results__correct-count">정답 {correct}명</span>{' '}
              · <span className="quiz-results__incorrect-count">오답 {incorrect}명</span> ·{' '}
              <span className="quiz-results__accuracy">정답률 {accuracy}%</span>
            </p>
            <span className="quiz-results__summary-help">점수·순위 없음 — 이해도 확인용</span>
          </div>
          <ul className="quiz-results__options">
            {question.options.map((option, optionIndex) => (
              <li key={optionIndex} className="quiz-results__option">
                <span
                  className={`quiz-results__option-label ${question.answer === optionIndex ? 'quiz-results__option-label--correct' : ''}`}
                >
                  <span className="quiz-results__option-number">
                    {question.type === 'ox' ? option : labels[optionIndex]}
                  </span>
                  {option}
                </span>
                <div
                  role="meter"
                  aria-label={`${option} 응답 비율`}
                  aria-valuenow={percentages[optionIndex]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="quiz-results__meter"
                >
                  <div
                    className="quiz-results__meter-fill"
                    data-correct={question.answer === optionIndex}
                    data-wrong-index={
                      question.options.slice(0, optionIndex).filter((_, i) => i !== question.answer)
                        .length
                    }
                    style={{
                      width: `${percentages[optionIndex]}%`,
                    }}
                  />
                </div>
                <span
                  className={`quiz-results__percentage ${question.answer === optionIndex ? 'quiz-results__percentage--correct' : ''}`}
                >
                  {percentages[optionIndex]}%
                </span>
              </li>
            ))}
          </ul>
          <p className="quiz-results__help">정답은 굵게 · 개인별 정답 여부는 표시하지 않음</p>
        </section>
      </div>
      <Chat
        compact
        screen="results"
        messages={messages}
        onSend={onSend}
        participants={room.participants}
      />
    </main>
  )
}
