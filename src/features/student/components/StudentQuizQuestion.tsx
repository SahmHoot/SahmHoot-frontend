import timer from '../../../assets/student/timer.svg'
import StudentAnswerOptions from './StudentAnswerOptions'
import { optionLabels } from '../data/studentFixtures'
import type { QuizQuestion, RoomPhase } from '../types/student.types'
import './StudentQuizQuestion.css'

interface Props {
  /** correctAnswer는 마감 전이거나 아직 모르면 -1이다. */
  question: Pick<QuizQuestion, 'title' | 'options' | 'correctAnswer'>
  index: number
  total: number
  phase: RoomPhase
  secondsLeft: number
  selected: number | null
  /** 늦은 제출·전송 실패 안내. */
  notice?: string | null
  onSelect: (index: number) => void
}

export default function StudentQuizQuestion({ question, index, total, phase, secondsLeft, selected, notice = null, onSelect }: Props) {
  const feedback = phase === 'feedback'
  const closing = phase === 'closing'
  const revealed = feedback && question.correctAnswer >= 0
  const answerCorrect = selected === question.correctAnswer
  const remaining = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  const hint = closing ? '답안을 마감하고 있습니다.'
    : revealed ? `${answerCorrect ? '정답 ✓' : selected === null ? '미응답' : '오답'} · 정답은 ${optionLabels[question.correctAnswer]} · 잠시 후 다음 화면으로 이동합니다`
      : feedback ? '문항이 마감되었습니다. 잠시 후 다음 화면으로 이동합니다.'
        : selected !== null ? `${optionLabels[selected]} 제출됨 · 마감 전까지 다른 답으로 바꿀 수 있어요`
          : '답을 고르면 바로 제출됩니다 · 마감 전까지 바꿀 수 있어요'
  return (
    <section className="student-question student-card" aria-labelledby="live-question-title">
      <progress className="student-question__progress" value={index + 1} max={total} aria-label="퀴즈 진행 상황" />
      <div className="student-question__body">
        <p className={`student-question__timer ${secondsLeft <= 5 && phase === 'question' ? 'student-question__timer--urgent' : ''}`}><img src={timer} alt="" />{index + 1} / {total} 문항 · {closing ? '마감 중' : feedback ? '정답 확인' : `남은 시간 ${remaining}`}</p>
        <h2 id="live-question-title">{question.title}</h2>
        <StudentAnswerOptions options={question.options} selected={selected} correctAnswer={question.correctAnswer} mode={revealed ? 'results' : 'answer'} disabled={phase !== 'question'} onSelect={onSelect} />
        {notice && <p className="student-question__notice" role="alert">{notice}</p>}
        <div className="student-question__footer">
          <p className="student-question__hint" role="status">{hint}</p>
        </div>
      </div>
    </section>
  )
}
