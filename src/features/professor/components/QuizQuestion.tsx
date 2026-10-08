import './QuizQuestion.css'
import type { Question, QuestionSet, QuizState } from '../dashboard-types'
import { labels } from '../dashboard-quiz'
import { Icon } from './Icon'

export function QuizQuestion({
  quiz,
  question,
  set,
  participants,
  onStop,
}: {
  quiz: QuizState
  question: Question
  set: QuestionSet
  participants: number
  onStop: () => void
}) {
  const responseCount = Math.round(participants * 0.875)
  const remaining = `${Math.floor(quiz.remaining / 60)}:${String(quiz.remaining % 60).padStart(2, '0')}`
  return (
    <>
      <section className="quiz-question">
        <div className="quiz-question__progress-track">
          <div
            className="quiz-question__progress-fill"
            style={{ width: `${((quiz.index + 1) / set.questions.length) * 100}%` }}
          />
        </div>
        <div className="quiz-question__content">
          <div className="quiz-question__toolbar">
            <p role="timer" className="quiz-question__timer">
              <Icon screen="quiz" name="imgFrame3" />
              {quiz.index + 1} / {set.questions.length} 문항 ·{' '}
              {quiz.phase === 'between'
                ? `다음 문제까지 ${quiz.remaining}초`
                : `남은 시간 ${remaining}`}
            </p>
            <button type="button" onClick={onStop} className="quiz-question__stop-button">
              퀴즈 중단
            </button>
          </div>
          <h2 className="quiz-question__title">{question.prompt}</h2>
          <ul className="quiz-question__options">
            {question.options.map((option, index) => (
              <li key={index} className="quiz-question__option">
                <span className="quiz-question__option-number" data-option-index={index}>
                  {question.type === 'ox' ? option : labels[index]}
                </span>
                <span className="quiz-question__option-text">{option}</span>
              </li>
            ))}
          </ul>
          <p className="quiz-question__answer-help">(정답 표시 없음)</p>
        </div>
      </section>
      <section className="quiz-question__responses">
        <div className="quiz-question__response-header">
          <p className="quiz-question__response-count">
            응답 <span className="quiz-question__count">{responseCount}명</span>{' '}
            <span className="quiz-question__participants">/ 접속 {participants}명</span>
          </p>
          <span className="quiz-question__response-label">점수·순위 없음 — 이해도 확인용</span>
        </div>
        <div className="quiz-question__response-track">
          <div
            className="quiz-question__response-fill"
            style={{
              width: `${participants ? (responseCount / participants) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="quiz-question__response-help">
          정답·분포는 퀴즈가 끝난 뒤 결과 화면에서 · 문항 마감 후 3초 뒤 다음 문항으로 이동합니다.
        </p>
      </section>
    </>
  )
}
