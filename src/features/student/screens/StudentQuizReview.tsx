import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import previousIcon from '../../../assets/student/chevron-left.svg'
import nextIcon from '../../../assets/student/chevron-right.svg'
import StudentHeader from '../components/StudentHeader'
import { getReviewSet } from '../../review/api'
import { useReviewResource } from '../../review/useReviewResource'
import { reviewResult } from '../../review/reviewResult'
import type { ReviewAnswers } from '../../review/reviewResult'
import type { QuestionSetDetailResponse } from '../../questionset/questionset.types'
import '../components/StudentAnswerOptions.css'
import './StudentQuizReview.css'

export default function StudentQuizReview() {
  const { setId = '' } = useParams()
  return <div className="student-app"><StudentHeader /><ReviewLoader key={setId} setId={setId} /></div>
}

function ReviewLoader({ setId }: { setId: string }) {
  const load = useCallback(() => getReviewSet(setId), [setId])
  const { data, loading, error, retry } = useReviewResource(load)
  if (data?.questions.length) return <ReviewContent quiz={data} />
  return <main className="student-review">
    {loading ? <p role="status">문제를 불러오는 중입니다.</p> : <>
      <h1>{error ?? '등록된 문제가 없는 세트입니다.'}</h1>
      {error && <button className="student-button" onClick={retry}>다시 시도</button>}
    </>}
    <Link className="student-button" to="/student">학생 홈으로</Link>
  </main>
}

function ReviewContent({ quiz }: { quiz: QuestionSetDetailResponse }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<ReviewAnswers>({})
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [finished, setFinished] = useState(false)
  const question = quiz.questions[index]
  const selected = answers[question.id]
  const checked = revealed[question.id] === true
  const result = reviewResult(quiz.questions, answers)

  return <main className="student-review">
    <div className="student-review__heading"><div><h1>{quiz.title}</h1><p>{quiz.ownerName} · {finished ? '복습 결과' : `${index + 1} / ${quiz.questions.length} 문항`}</p></div><Link className="student-button" to="/student">나가기</Link></div>
    {finished ? <section className="student-review__question student-card" aria-labelledby="review-result-title">
      <h2 id="review-result-title">복습을 마쳤어요</h2>
      <dl className="student-review__summary">
        <div><dt>총 문항 수</dt><dd>{result.total}문항</dd></div>
        <div><dt>정답 수</dt><dd>{result.correct}개</dd></div>
        <div><dt>오답 수</dt><dd>{result.wrong}개</dd></div>
        <div><dt>정답률</dt><dd>{result.rate}%</dd></div>
      </dl>
      <p className="student-review__hint">풀이 결과는 저장되지 않습니다.</p>
      <button className="student-button" onClick={() => { setFinished(false); setIndex(0) }}>문항 다시 보기</button>
    </section> : <>
      <div className="student-review__progress" role="progressbar" aria-label="복습 진행 상황" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={quiz.questions.length}>
        {quiz.questions.map((item, position) => <span key={item.id} className={position <= index ? 'student-review__step--active' : ''} />)}
      </div>
      <section className="student-review__question student-card" aria-labelledby="review-question-title">
        <p className="student-review__hint">{question.type === 'TRUE_FALSE' ? 'O/X 문제' : '객관식 문제'}</p>
        <h2 id="review-question-title">{question.content}</h2>
        <div className="student-answers" role="group" aria-label="문제 선택지">
          {question.choices.map((choice, position) => <button key={choice.id} type="button"
            className={`student-answers__option ${selected === choice.id ? 'student-answers__option--selected' : ''} ${checked && choice.isCorrect ? 'student-answers__option--correct' : ''} ${checked && selected === choice.id && !choice.isCorrect ? 'student-answers__option--wrong' : ''}`}
            aria-pressed={selected === choice.id}
            onClick={() => { setAnswers(values => ({ ...values, [question.id]: choice.id })); setRevealed(values => ({ ...values, [question.id]: false })) }}>
            <span className={`student-answers__number student-answers__number--${position}`}>{question.type === 'TRUE_FALSE' ? choice.content : position + 1}</span>
            <span className="student-answers__text">{choice.content}</span>
            {checked && choice.isCorrect && <span className="student-answers__badge student-answers__badge--correct">정답</span>}
            {checked && selected === choice.id && !choice.isCorrect && <span className="student-answers__badge student-answers__badge--wrong">내가 고른 답</span>}
          </button>)}
        </div>
        <button className="student-button student-review__check" disabled={selected === undefined || checked} onClick={() => setRevealed(values => ({ ...values, [question.id]: true }))}>정답 확인</button>
        <p role="status" className="student-review__hint">{checked ? question.choices.some(choice => choice.id === selected && choice.isCorrect) ? '정답입니다.' : '오답입니다. 정답을 확인해 보세요.' : '답을 고른 뒤 정답을 확인해 주세요.'}</p>
      </section>
      <div className="student-review__navigation">
        <button className="student-button" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><img src={previousIcon} alt="" />이전 문항</button>
        <button className="student-button student-button--primary" disabled={!checked || (index === quiz.questions.length - 1 && result.unanswered > 0)} onClick={() => index === quiz.questions.length - 1 ? setFinished(true) : setIndex(value => value + 1)}>{index === quiz.questions.length - 1 ? '복습 완료' : '다음 문항'}<img src={nextIcon} alt="" /></button>
      </div>
    </>}
  </main>
}
