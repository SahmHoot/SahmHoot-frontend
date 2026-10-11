import { useState } from 'react'
import StudentAnswerOptions from './StudentAnswerOptions'
import { optionLabels } from '../data/studentFixtures'
import type { QuizSet } from '../types/student.types'
import './StudentQuizResults.css'

interface Props {
  quiz: QuizSet
  answers: (number | null)[]
  initialIndex?: number
}

export default function StudentQuizResults({ quiz, answers, initialIndex = 0 }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const question = quiz.questions[index]
  const answer = answers[index]
  const correct = answer === question.correctAnswer
  return (
    <section className="student-results student-card" aria-labelledby="result-question-title">
      <p className="student-results__counter">퀴즈 결과 · <strong>{index + 1} / {quiz.questions.length}</strong></p>
      <h2 id="result-question-title">{question.title}</h2>
      <StudentAnswerOptions mode="results" options={question.options} selected={answer} correctAnswer={question.correctAnswer} />
      <div className="student-results__footer">
        <p>내 답: {answer === null ? '미응답' : optionLabels[answer]} · <strong className={correct ? 'student-results__correct' : 'student-results__wrong'}>{correct ? '정답 ✓' : answer === null ? '미응답' : '오답'}</strong> · 반 정답률 <strong>{question.correctRate}%</strong> (응답 {question.responseCount}명)</p>
        <div className="student-results__navigation">
          <button className="student-button" disabled={index === 0} onClick={() => setIndex(previous => previous - 1)}>이전 문항</button>
          <button className="student-button student-button--primary" disabled={index === quiz.questions.length - 1} onClick={() => setIndex(previous => previous + 1)}>다음 문항</button>
        </div>
      </div>
    </section>
  )
}
