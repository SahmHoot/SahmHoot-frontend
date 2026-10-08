import './QuizSetList.css'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { QuestionSet } from '../dashboard-types'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'

export function QuizSetList({
  sets,
  onDelete,
}: {
  sets: QuestionSet[]
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState<QuestionSet | null>(null)
  return (
    <main className="quiz-set-list">
      <div className="quiz-set-list__heading-row">
        <h1 className="quiz-set-list__title">문제 세트</h1>
        <button
          type="button"
          onClick={() => navigate('/professor/sets/new')}
          className="quiz-set-list__create-button"
        >
          <Icon screen="sets" name="imgFrame2" />새 세트 만들기
        </button>
      </div>
      <div className="quiz-set-list__sets">
        <div className="quiz-set-list__table-header">
          <span>세트 이름</span>
          <span>문항 수</span>
          <span>공개 여부</span>
          <span className="quiz-set-list__action-label">작업</span>
        </div>
        {sets.map((set) => (
          <article key={set.id} className="quiz-set-list__set-row">
            <Link to={`/professor/sets/${set.id}`} className="quiz-set-list__set-name">
              {set.name}
            </Link>
            <span className="quiz-set-list__set-meta">
              {set.questions.length}문항 · 문제당 {set.seconds}초
            </span>
            <span className="quiz-set-list__visibility-cell">
              <span
                className={`quiz-set-list__visibility ${set.isPublic ? 'quiz-set-list__visibility--public' : 'quiz-set-list__visibility--private'}`}
              >
                <Icon screen="sets" name={set.isPublic ? 'imgFrame3' : 'imgFrame4'} />
                {set.isPublic ? '공개' : '비공개'}
              </span>
            </span>
            <div className="quiz-set-list__actions">
              <Link
                to={`/professor/sets/${set.id}`}
                className="quiz-set-list__edit-button"
                aria-label={`${set.name} 편집`}
              >
                편집
              </Link>
              <button
                type="button"
                onClick={() => setDeleting(set)}
                className="quiz-set-list__delete-button"
                aria-label={`${set.name} 삭제`}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
        {sets.length === 0 && (
          <div className="quiz-set-list__empty">
            저장된 문제 세트가 없습니다. 새 세트를 만들어 주세요.
          </div>
        )}
      </div>
      <p className="quiz-set-list__help">
        공개하면 학생이 문제와 정답을 복습할 수 있습니다. 수업 전 정답 노출을 원하지 않으면 비공개로
        두세요.
      </p>
      {deleting && (
        <Modal title="문제 세트 삭제" onClose={() => setDeleting(null)}>
          <p className="quiz-set-list__delete-message">‘{deleting.name}’ 세트를 삭제할까요?</p>
          <div className="quiz-set-list__dialog-actions">
            <button
              type="button"
              className="quiz-set-list__cancel-button"
              onClick={() => setDeleting(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="quiz-set-list__confirm-delete-button"
              onClick={() => {
                onDelete(deleting.id)
                setDeleting(null)
              }}
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
