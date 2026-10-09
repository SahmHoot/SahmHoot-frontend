import { Link } from 'react-router-dom'
import book from '../../../assets/student/book.svg'
import type { QuizSet } from '../types/student.types'
import './StudentReviewSetList.css'

export default function StudentReviewSetList({ sets }: { sets: QuizSet[] }) {
  return (
    <section className="student-review-list" aria-labelledby="review-list-title">
      <h2 id="review-list-title">다시 풀어보기</h2>
      {sets.map(set => (
        <article className="student-review-list__item student-card" key={set.id}>
          <div className="student-review-list__info">
            <span className="student-review-list__icon"><img src={book} alt="" /></span>
            <div><h3>{set.title}</h3><p>{set.questions.length}문항 · {set.subject}</p></div>
          </div>
          <Link className="student-button" to={`/student/review/${set.id}`} aria-label={`${set.title} 풀기`}>풀기</Link>
        </article>
      ))}
    </section>
  )
}
