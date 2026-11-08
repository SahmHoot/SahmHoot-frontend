import { Link } from 'react-router-dom'
import { useRoomQuestionSets } from '../../questionset/useRoomQuestionSets'
import type { RoomQuestionSet } from '../dashboard-types'

export function RoomSetPicker({ onSelect }: { onSelect: (set: RoomQuestionSet) => void }) {
  const { sets, loading, listError, detailError, selectedId, selecting, reload, select } = useRoomQuestionSets(onSelect)
  return (
    <div className="professor-room__set-choices" aria-busy={loading || selecting}>
      {loading && <p role="status" className="professor-room__empty-message">문제 세트 목록을 불러오는 중입니다.</p>}
      {listError && <p role="alert" className="professor-room__set-error">{listError}</p>}
      {!loading && !listError && sets.map((item) => (
        <button key={item.id} type="button" className="professor-room__set-choice"
          disabled={selecting || item.questionCount === 0} onClick={() => void select(item.id)}>
          <span className="professor-room__choice-name">{item.title}</span>
          <span className="professor-room__choice-meta">
            {item.questionCount}문항 · {item.visibility === 'PUBLIC' ? '공개' : '비공개'}
            {item.questionCount === 0 ? ' · 문항을 추가해 주세요' : ' · 문항별 제한시간 적용'}
          </span>
        </button>
      ))}
      {selecting && <p role="status">문항 상세를 불러오는 중입니다.</p>}
      {detailError && <p role="alert" className="professor-room__set-error">{detailError}</p>}
      {detailError && selectedId !== null && (
        <button type="button" className="professor-room__continue-button" disabled={selecting} onClick={() => void select(selectedId)}>선택 다시 시도</button>
      )}
      {!loading && !listError && sets.length === 0 && <p className="professor-room__empty-message">저장된 문제 세트가 없습니다.</p>}
      {!loading && !listError && !sets.some((set) => set.questionCount > 0) && (
        <Link to="/professor/sets/new" className="professor-room__create-button">새 세트 만들기</Link>
      )}
      {!loading && <button type="button" className="professor-room__continue-button" disabled={selecting} onClick={reload}>
        {listError ? '다시 불러오기' : '목록 새로고침'}
      </button>}
    </div>
  )
}
