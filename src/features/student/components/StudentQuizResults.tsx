import { useState } from 'react'
import StudentAnswerOptions from './StudentAnswerOptions'
import { optionLabels } from '../data/studentFixtures'
import type { QuizResult } from '../../quiz/types'
import './StudentQuizResults.css'

interface Props {
  result: QuizResult
  /** 문항(runQuestionId)별 내 선택지 ID. 답하지 않았으면 null. */
  answerOf: (runQuestionId: number) => number | null
}

/** 퀴즈 결과 복습(QZ-06). 문항별 정답·내 답·반 정답률만 보여 주고 점수·순위는 만들지 않는다(QZ-07). */
export default function StudentQuizResults({ result, answerOf }: Props) {
  const [index, setIndex] = useState(0)
  const question = result.questions[index]
  if (!question) return <section className="student-results student-card"><h2>퀴즈가 종료되었습니다</h2></section>
  const answerId = answerOf(question.runQuestionId)
  const answer = answerId === null ? -1 : question.choices.findIndex((choice) => choice.id === answerId)
  const correctAnswer = question.choices.findIndex((choice) => choice.id === question.correctChoiceId)
  const correct = answer >= 0 && answer === correctAnswer
  // 교수 결과 화면과 같은 계산(06 4절): 정답률 = correctCount ÷ answeredCount, 응답이 없으면 0%.
  const accuracy = question.answeredCount ? Math.round((question.correctCount / question.answeredCount) * 100) : 0
  const total = result.questions.length
  return (
    <section className="student-results student-card" aria-labelledby="result-question-title">
      <p className="student-results__counter">퀴즈 결과 · <strong>{index + 1} / {total}</strong></p>
      <h2 id="result-question-title">{question.content}</h2>
      <StudentAnswerOptions mode="results" options={question.choices.map((choice) => choice.content)} selected={answer < 0 ? null : answer} correctAnswer={correctAnswer} />
      <div className="student-results__footer">
        <p>내 답: {answer < 0 ? '미응답' : optionLabels[answer]} · <strong className={correct ? 'student-results__correct' : 'student-results__wrong'}>{correct ? '정답 ✓' : answer < 0 ? '미응답' : '오답'}</strong> · 반 정답률 <strong>{accuracy}%</strong> (응답 {question.answeredCount}명)</p>
        <div className="student-results__navigation">
          <button className="student-button" disabled={index === 0} onClick={() => setIndex((previous) => previous - 1)}>이전 문항</button>
          <button className="student-button student-button--primary" disabled={index === total - 1} onClick={() => setIndex((previous) => previous + 1)}>다음 문항</button>
        </div>
      </div>
    </section>
  )
}
