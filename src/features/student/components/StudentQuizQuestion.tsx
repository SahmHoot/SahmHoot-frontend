import timer from '../../../assets/student/timer.svg'
import StudentAnswerOptions from './StudentAnswerOptions'
import { CountdownBar } from '../../quiz/components/CountdownBar'
import { AnswerRevealOverlay } from './AnswerRevealOverlay'
import { QuestionImage } from '../../../shared/components/QuestionImage'
import type { ImageMetadata } from '../../../shared/api/image'
import type { QuizQuestion, RoomPhase } from '../types/student.types'
import './StudentQuizQuestion.css'

interface Props {
  /** correctAnswer는 마감 전이거나 아직 모르면 -1이다. */
  question: Pick<QuizQuestion, 'title' | 'options' | 'correctAnswer'>
  image?: ImageMetadata | null
  index: number
  total: number
  phase: RoomPhase
  secondsLeft: number
  timeLimitSeconds: number
  closesAt: string
  clockOffsetMs: number
  selected: number | null
  /** 늦은 제출·전송 실패 안내. */
  notice?: string | null
  onSelect: (index: number) => void
}

export default function StudentQuizQuestion({ question, image, index, total, phase, secondsLeft, timeLimitSeconds, closesAt, clockOffsetMs, selected, notice = null, onSelect }: Props) {
  const feedback = phase === 'feedback'
  const closing = phase === 'closing'
  const urgent = secondsLeft <= 5 && phase === 'question'
  const revealed = feedback && question.correctAnswer >= 0 && question.correctAnswer < question.options.length
  const remaining = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
  const hint = closing ? '답안을 마감하고 있습니다.'
    : revealed ? '잠시 후 다음 문항으로 이동합니다'
      : feedback ? '문항이 마감되었습니다. 잠시 후 다음 화면으로 이동합니다.'
        : selected !== null ? '답안을 제출했습니다 · 마감 전까지 다른 답으로 바꿀 수 있어요'
          : '답을 고르면 바로 제출됩니다 · 마감 전까지 바꿀 수 있어요'
  return (
    <>
    {revealed && <AnswerRevealOverlay key={`${index}:${question.title}`} answer={question.options[question.correctAnswer]}
      correct={selected === question.correctAnswer} answered={selected !== null} />}
    <section className="student-question student-card" aria-labelledby="live-question-title">
      <CountdownBar closesAt={closesAt} clockOffsetMs={clockOffsetMs}
        timeLimitSeconds={timeLimitSeconds} secondsLeft={secondsLeft} active={phase === 'question'} urgent={urgent}
        valueText={feedback ? '문항 마감' : closing ? '마감 중' : `${Math.min(secondsLeft, timeLimitSeconds)}초 남음`} />
      <div className="student-question__body">
        <p className={`student-question__timer ${urgent ? 'student-question__timer--urgent' : ''}`}><img src={timer} alt="" />{index + 1} / {total} 문항 · {closing ? '마감 중' : feedback ? '정답 확인' : `남은 시간 ${remaining}`}</p>
        <h2 id="live-question-title">{question.title}</h2>
        <QuestionImage image={image} />
        <StudentAnswerOptions key={`${index}:${question.title}`} options={question.options} selected={selected} correctAnswer={question.correctAnswer} mode={revealed ? 'results' : 'answer'} disabled={phase !== 'question'} onSelect={onSelect} />
        {notice && <p className="student-question__notice" role="alert">{notice}</p>}
        <div className="student-question__footer">
          <p className="student-question__hint" role="status">{hint}</p>
        </div>
      </div>
    </section>
    </>
  )
}
