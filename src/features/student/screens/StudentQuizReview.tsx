import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import previousIcon from '../../../assets/student/chevron-left.svg'
import nextIcon from '../../../assets/student/chevron-right.svg'
import StudentHeader from '../components/StudentHeader'
import StudentAnswerOptions from '../components/StudentAnswerOptions'
import { reviewSets } from '../data/studentFixtures'
import { readAnswers, saveAnswers } from '../data/studentStorage'
import type { QuizSet } from '../types/student.types'
import './StudentQuizReview.css'

export default function StudentQuizReview() {
  const { setId } = useParams()
  const quiz = reviewSets.find(set => set.id === setId)
  return (
    <div className="student-app">
      <StudentHeader />
      {quiz ? <ReviewContent key={quiz.id} quiz={quiz} /> : <main className="student-review"><h1>문제 모음집을 찾을 수 없습니다.</h1><Link className="student-button" to="/student">학생 홈으로</Link></main>}
    </div>
  )
}

function ReviewContent({ quiz }: { quiz: QuizSet }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState(() => readAnswers(quiz.id, quiz.questions.length))
  const question = quiz.questions[index]
  const answer = answers[index]

  function selectAnswer(value: number) {
    const next = answers.map((existing, answerIndex) => answerIndex === index ? value : existing)
    setAnswers(next)
    saveAnswers(quiz.id, next)
  }

  return (
    <main className="student-review">
      <div className="student-review__heading"><div><h1>{quiz.title}</h1><p><strong>{index + 1} / {quiz.questions.length} 문항</strong> · 복습 모드에는 점수가 없습니다</p></div><Link className="student-button" to="/student">나가기</Link></div>
      <div className="student-review__progress" role="progressbar" aria-label="복습 진행 상황" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={quiz.questions.length}>
        {quiz.questions.map((item, questionIndex) => <span key={item.id} className={questionIndex <= index ? 'student-review__step--active' : ''} />)}
      </div>
      <section className="student-review__question student-card" aria-labelledby="review-question-title">
        <h2 id="review-question-title">{question.title}</h2>
        <StudentAnswerOptions options={question.options} selected={answer} correctAnswer={question.correctAnswer} mode={answer === null ? 'answer' : 'review'} onSelect={selectAnswer} />
        {answer === null && <p className="student-review__hint">답을 선택하면 정답을 확인할 수 있어요.</p>}
      </section>
      <div className="student-review__navigation">
        <button className="student-button" disabled={index === 0} onClick={() => setIndex(previous => previous - 1)}><img src={previousIcon} alt="" />이전 문항</button>
        <button className="student-button student-button--primary" onClick={() => index === quiz.questions.length - 1 ? navigate('/student') : setIndex(previous => previous + 1)}>{index === quiz.questions.length - 1 ? '복습 완료' : '다음 문항'}<img src={nextIcon} alt="" /></button>
      </div>
    </main>
  )
}
