import { AnswerParticles } from './AnswerReveal'
import './StudentAnswerOptions.css'

interface Props {
  options: string[]
  selected: number | null
  correctAnswer?: number
  mode?: 'answer' | 'results' | 'review'
  disabled?: boolean
  /** results 모드에서 선택지 옆에 보일 반 전체 분포(퀴즈 결과 화면에서만). */
  stats?: string[]
  onSelect?: (index: number) => void
}

export default function StudentAnswerOptions({ options, selected, correctAnswer, mode = 'answer', disabled = false, stats, onSelect }: Props) {
  const reveal = mode !== 'answer' && correctAnswer !== undefined && correctAnswer >= 0 && correctAnswer < options.length
  return (
    <div className={`student-answers ${options.length === 2 ? 'student-answers--true-false' : ''} ${reveal ? 'student-answers--revealed' : ''}`} role="group" aria-label="문제 선택지">
      {options.map((option, index) => {
        const correct = reveal && correctAnswer === index
        const wrong = reveal && selected === index && !correct
        const highlighted = mode === 'answer' && selected === index
        const content = <>
          {(correct || wrong) && <span className={`student-answers__result-label ${correct ? 'student-answers__result-label--correct' : 'student-answers__result-label--wrong'}`}>
            {correct ? selected === index ? '정답 · 내 선택' : '정답' : '내가 고른 답'}
          </span>}
          <span className="student-answers__text">{option}</span>
          {correct && <AnswerParticles />}
          {mode === 'results' && stats && <span className="student-answers__stat">{stats[index]}</span>}
        </>
        const classes = `student-answers__option ${highlighted ? 'student-answers__option--selected' : ''} ${correct ? 'student-answers__option--correct' : ''} ${wrong ? 'student-answers__option--wrong' : ''} ${reveal && !correct && !wrong ? 'student-answers__option--quiet' : ''}`
        return mode === 'answer' ? (
          <button key={index} type="button" className={classes} disabled={disabled} aria-pressed={selected === index} onClick={() => onSelect?.(index)}>{content}</button>
        ) : <div key={index} className={classes}>{content}</div>
      })}
    </div>
  )
}
