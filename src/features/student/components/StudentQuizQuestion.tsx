import timer from '../../../assets/student/timer.svg'
import StudentAnswerOptions from './StudentAnswerOptions'
import { optionLabels } from '../data/studentFixtures'
import type { QuizQuestion, RoomPhase } from '../types/student.types'
import './StudentQuizQuestion.css'

interface Props {
  question: Pick<QuizQuestion, 'title' | 'options' | 'correctAnswer'>
  index: number
  total: number
  phase: RoomPhase
  secondsLeft: number
  selected: number | null
  submitted: boolean
  onSelect: (index: number) => void
  onSubmit: () => void
  readOnly?: boolean
}

export default function StudentQuizQuestion({ question, index, total, phase, secondsLeft, selected, submitted, onSelect, onSubmit, readOnly = false }: Props) {
  const feedback = phase === 'feedback'
  const closing = phase === 'closing'
  const answerCorrect = selected === question.correctAnswer
  const remaining = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  return (
    <section className="student-question student-card" aria-labelledby="live-question-title">
      <progress className="student-question__progress" value={index + 1} max={total} aria-label="퀴즈 진행 상황" />
      <div className="student-question__body">
        <p className={`student-question__timer ${secondsLeft <= 5 && phase === 'question' ? 'student-question__timer--urgent' : ''}`}><img src={timer} alt="" />{index + 1} / {total} 문항 · {closing ? '마감 중' : feedback ? '정답 확인' : `남은 시간 ${remaining}`}</p>
        <h2 id="live-question-title">{question.title}</h2>
        <StudentAnswerOptions options={question.options} selected={selected} correctAnswer={question.correctAnswer} mode={feedback && !readOnly ? 'results' : 'answer'} disabled={readOnly || submitted || phase !== 'question'} onSelect={onSelect} />
        <div className="student-question__footer">
          <p className="student-question__hint" role="status">{readOnly ? feedback ? '문항이 마감되었습니다. 다음 안내를 기다려 주세요.' : '문제가 진행 중입니다.' : closing ? '답안을 마감하고 있습니다.' : feedback ? `${answerCorrect ? '정답 ✓' : selected === null ? '미응답' : '오답'} · 정답은 ${optionLabels[question.correctAnswer]} · 잠시 후 다음 화면으로 이동합니다` : submitted ? '제출 완료 · 교수님이 다음 문제를 진행할 때까지 기다려 주세요.' : '시간이 끝나면 자동으로 제출됩니다 · 그 전에는 답을 바꿀 수 있어요'}</p>
          {!readOnly && <button className="student-button student-button--primary" onClick={onSubmit} disabled={selected === null || submitted || phase !== 'question'}>{closing ? '마감 중' : feedback ? '정답 확인' : submitted ? '제출 완료' : '제출하기'}</button>}
        </div>
      </div>
    </section>
  )
}
