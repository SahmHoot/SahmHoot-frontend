import check from '../../../assets/student/check.svg'
import { optionLabels } from '../data/studentFixtures'
import './StudentAnswerOptions.css'

interface Props {
  options: string[]
  selected: number | null
  correctAnswer?: number
  mode?: 'answer' | 'results' | 'review'
  disabled?: boolean
  onSelect?: (index: number) => void
}

export default function StudentAnswerOptions({ options, selected, correctAnswer, mode = 'answer', disabled = false, onSelect }: Props) {
  const reveal = mode !== 'answer'
  return (
    <div className="student-answers" role="group" aria-label="문제 선택지">
      {options.map((option, index) => {
        const correct = reveal && correctAnswer === index
        const wrong = reveal && selected === index && !correct
        const highlighted = mode === 'answer' ? selected === index : mode === 'results' && correct
        const content = <><span className={`student-answers__number student-answers__number--${index}`}>{optionLabels[index]}</span><span className="student-answers__text">{option}</span>
          {highlighted && <span className="student-answers__check"><img src={check} alt={mode === 'answer' ? '선택됨' : '정답'} /></span>}
          {mode === 'review' && correct && <span className="student-answers__badge student-answers__badge--correct">정답</span>}
          {mode === 'review' && wrong && <span className="student-answers__badge student-answers__badge--wrong">내가 고른 답</span>}
          {mode === 'results' && wrong && <span className="student-answers__badge student-answers__badge--wrong">내가 고른 답</span>}
        </>
        const classes = `student-answers__option ${highlighted ? 'student-answers__option--selected' : ''} ${mode === 'review' && correct ? 'student-answers__option--correct' : ''} ${wrong ? 'student-answers__option--wrong' : ''}`
        return mode === 'answer' ? (
          <button key={index} type="button" className={classes} disabled={disabled} aria-pressed={selected === index} onClick={() => onSelect?.(index)}>{content}</button>
        ) : <div key={index} className={classes}>{content}</div>
      })}
    </div>
  )
}
