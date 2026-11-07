import './QuizSetList.css'
import { Link, useNavigate } from 'react-router-dom'
import { useQuestionSetList } from '../../questionset/useQuestionSetList'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'

export function QuizSetList() {
  const navigate = useNavigate()
  const { sets, loading, loadError, deleting, setDeleting, deletePending, deleteError,
    setDeleteError, reload, confirmDelete } = useQuestionSetList()
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
      <div className="quiz-set-list__sets" aria-busy={loading}>
        <div className="quiz-set-list__table-header">
          <span>세트 이름</span>
          <span>문항 수</span>
          <span>공개 여부</span>
          <span className="quiz-set-list__action-label">작업</span>
        </div>
        {loading && <p role="status" className="quiz-set-list__empty">문제 세트를 불러오는 중입니다.</p>}
        {!loading && loadError && (
          <div className="quiz-set-list__empty">
            <p role="alert">{loadError}</p>
            <button
              type="button"
              className="quiz-set-list__retry-button"
              disabled={deletePending}
              onClick={() => void reload()}
            >
              다시 시도
            </button>
          </div>
        )}
        {!loading && !loadError && sets.map((set) => (
          <article key={set.id} className="quiz-set-list__set-row">
            <Link to={`/professor/sets/${set.id}`} className="quiz-set-list__set-name">
              {set.title}
            </Link>
            <span className="quiz-set-list__set-meta">
              {set.questionCount}문항
            </span>
            <span className="quiz-set-list__visibility-cell">
              <span
                className={`quiz-set-list__visibility ${set.visibility === 'PUBLIC' ? 'quiz-set-list__visibility--public' : 'quiz-set-list__visibility--private'}`}
              >
                <Icon screen="sets" name={set.visibility === 'PUBLIC' ? 'imgFrame3' : 'imgFrame4'} />
                {set.visibility === 'PUBLIC' ? '공개' : '비공개'}
              </span>
            </span>
            <div className="quiz-set-list__actions">
              <Link
                to={`/professor/sets/${set.id}`}
                className="quiz-set-list__edit-button"
                aria-label={`${set.title} 편집`}
              >
                편집
              </Link>
              <button
                type="button"
                onClick={() => {
                  setDeleteError('')
                  setDeleting(set)
                }}
                disabled={deletePending || loading || Boolean(loadError)}
                className="quiz-set-list__delete-button"
                aria-label={`${set.title} 삭제`}
              >
                삭제
              </button>
            </div>
          </article>
        ))}
        {!loading && !loadError && sets.length === 0 && (
          <div role="status" className="quiz-set-list__empty">
            저장된 문제 세트가 없습니다. 새 세트를 만들어 주세요.
          </div>
        )}
      </div>
      {!deleting && deleteError && <p role="alert" className="quiz-set-list__error">{deleteError}</p>}
      {!deleting && deletePending && <p role="status">{loading ? '삭제 결과를 확인하는 중입니다.' : '문제 세트를 삭제하는 중입니다.'}</p>}
      <p className="quiz-set-list__help">
        공개하면 학생이 문제와 정답을 복습할 수 있습니다. 수업 전 정답 노출을 원하지 않으면 비공개로
        두세요.
      </p>
      {deleting && (
        <Modal title="문제 세트 삭제" onClose={() => setDeleting(null)}>
          <p className="quiz-set-list__delete-message">‘{deleting.title}’ 세트를 삭제할까요?</p>
          {deleteError && <p role="alert" className="quiz-set-list__error">{deleteError}</p>}
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
              disabled={deletePending || loading || Boolean(loadError)}
              onClick={() => void confirmDelete()}
            >
              {deletePending ? '삭제 중…' : '삭제'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
