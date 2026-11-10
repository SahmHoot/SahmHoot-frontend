import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import book from '../../../assets/student/book.svg'
import { getPublicQuestionSets } from '../../review/api'
import { useReviewResource } from '../../review/useReviewResource'
import './StudentReviewSetList.css'

export default function StudentReviewSetList() {
  const [page, setPage] = useState(0)
  const load = useCallback(() => getPublicQuestionSets(page), [page])
  const { data, loading, error, retry } = useReviewResource(load)
  const lastPage = Math.max(0, (data?.totalPages ?? page + 1) - 1)
  const correcting = Boolean(data && page > lastPage)
  useEffect(() => {
    if (correcting) setPage(lastPage)
  }, [correcting, lastPage])
  return (
    <section className="student-review-list" aria-labelledby="review-list-title">
      <h2 id="review-list-title">다시 풀어보기</h2>
      {(loading || correcting) && <p role="status">공개 문제 세트를 불러오는 중입니다.</p>}
      {error && <div role="alert"><p>{error}</p><button className="student-button" onClick={retry}>다시 시도</button></div>}
      {!correcting && data?.content.length === 0 && <p>{data.totalElements === 0 ? '공개된 문제 세트가 없습니다.' : '이 페이지에 표시할 문제 세트가 없습니다.'}</p>}
      {!correcting && data?.content.map(set => (
        <article className="student-review-list__item student-card" key={set.id}>
          <div className="student-review-list__info">
            <span className="student-review-list__icon"><img src={book} alt="" /></span>
            <div><h3>{set.title}</h3><p>{set.questionCount}문항 · {set.ownerName}</p></div>
          </div>
          <Link className="student-button" to={`/student/review/${set.id}`} aria-label={`${set.title} 풀기`}>풀기</Link>
        </article>
      ))}
      <nav className="student-review-list__pages" aria-label="공개 세트 페이지">
        <button className="student-button" disabled={loading || correcting || page === 0} onClick={() => setPage(value => value - 1)}>이전</button>
        <span aria-live="polite">{Math.min(page, lastPage) + 1} / {Math.max(1, data?.totalPages ?? page + 1)}</span>
        <button className="student-button" disabled={loading || correcting || !data || page + 1 >= data.totalPages} onClick={() => setPage(value => value + 1)}>다음</button>
      </nav>
    </section>
  )
}
