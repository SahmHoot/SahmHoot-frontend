import { useEffect, useRef, useState } from 'react'
import { useHref } from 'react-router-dom'
import { Button } from '../../../shared/components/Button'
import { useAuth } from '../../auth/AuthProvider'
import { useRoomQuestionSets } from '../../questionset/useRoomQuestionSets'
import type { RoomQuestionSet } from '../dashboard-types'
import { writeRoomId } from '../roomStorage'
import { roomSetCancelled, roomSetSaved } from '../roomSetReturn'

export function RoomSetPicker({ onStart }: { onStart: (set: RoomQuestionSet) => void }) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<RoomQuestionSet | null>(null)
  const [editorError, setEditorError] = useState(false)
  const editorTab = useRef<Window | null>(null)
  const editorUrl = useHref('/professor/sets/new?from=room')
  const { sets, loading, listError, detailError, selectedId, selecting, reload, select } = useRoomQuestionSets(setSelected)
  const ready = !loading && !selecting && !detailError && selected?.id === selectedId ? selected : null

  useEffect(() => {
    const handleEditorCompletion = (event: MessageEvent) => {
      if (event.origin !== window.location.origin ||
        (event.data !== roomSetSaved && event.data !== roomSetCancelled)) return

      if (event.source === editorTab.current) editorTab.current = null
      reload()
    }
    window.addEventListener('message', handleEditorCompletion)
    return () => window.removeEventListener('message', handleEditorCompletion)
  }, [reload])

  const openEditor = () => {
    // 새 탭은 로그인 세션을 상속하지만 수업에는 연결하지 않는다.
    if (editorTab.current && !editorTab.current.closed) {
      editorTab.current.focus()
      return
    }
    const editor = window.open('', '_blank')
    setEditorError(!editor)
    if (editor) {
      writeRoomId(user?.id, null, editor)
      editorTab.current = editor
      editor.location.replace(editorUrl)
    }
  }

  return (
    <div className="professor-room__set-choices">
      <div className="professor-room__set-list">
        {loading && <p role="status" className="professor-room__empty-message">문제 세트 목록을 불러오는 중입니다.</p>}
        {listError && <p role="alert" className="professor-room__set-error">{listError}</p>}
        {!loading && !listError && sets.map((item) => (
          <button key={item.id} type="button" className="professor-room__set-choice"
            aria-pressed={ready?.id === item.id}
            aria-disabled={selecting || undefined} disabled={item.questionCount === 0} onClick={() => void select(item.id)}>
            <span className="professor-room__choice-name">{item.title}</span>
            <span className="professor-room__choice-meta">
              {item.questionCount}문항 · {item.visibility === 'PUBLIC' ? '공개' : '비공개'}
              {item.questionCount === 0 ? ' · 문항을 추가해 주세요' : ' · 문항별 제한시간 적용'}
            </span>
          </button>
        ))}
        {!loading && !listError && sets.length === 0 && <p className="professor-room__empty-message">저장된 문제 세트가 없습니다.</p>}
      </div>
      {(selecting || detailError || editorError) && (
        <div className="professor-room__set-feedback">
          {selecting && <p role="status">문항 상세를 불러오는 중입니다.</p>}
          {detailError && <p role="alert" className="professor-room__set-error">{detailError}</p>}
          {detailError && selectedId !== null && (
            <button type="button" className="professor-room__continue-button" disabled={selecting} onClick={() => void select(selectedId)}>선택 다시 시도</button>
          )}
          {editorError && <p role="alert" className="professor-room__set-error">편집기 탭을 열지 못했습니다. 팝업을 허용한 뒤 다시 시도해 주세요.</p>}
        </div>
      )}
      <div className="professor-room__set-actions">
        <Button variant="outline" onClick={openEditor} aria-label="새 문제 세트 만들기 (새 탭)">+ 새 문제 세트 만들기</Button>
        <Button variant="outline" disabled={loading || selecting} onClick={reload}>
          {listError ? '다시 불러오기' : '목록 새로고침'}
        </Button>
        <Button disabled={!ready} onClick={() => { if (ready) onStart(ready) }}>선택한 세트로 퀴즈 시작</Button>
      </div>
    </div>
  )
}
