import './QuizSetEditor.css'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { newQuestion } from '../../questionset/editorDraft'
import type { EditorQuestion } from '../../questionset/editorDraft'
import { useQuestionSetEditor } from '../../questionset/useQuestionSetEditor'
import { EditorRecoveryPanel } from '../../questionset/EditorRecoveryPanel'
import { labels } from '../dashboard-quiz'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'

export function QuizSetEditor() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const { draft, setDraft, selectedId, setSelectedId, loading, saving, error, setError,
    needsReload, creationUnknown, save, reload, originalDraft, recovery, recoveryResolved,
    serverDraft, restore, useServer } = useQuestionSetEditor(setId, () => navigate('/professor/sets', { replace: true }))
  const [cancelling, setCancelling] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)
  const selectedIndex = Math.max(
    0,
    draft.questions.findIndex((question) => question.id === selectedId),
  )
  const question = draft.questions[selectedIndex]
  const blocked = saving || Boolean(recovery && !recoveryResolved)
  const recoveryPanel = <EditorRecoveryPanel recovery={recovery} server={needsReload ? null : serverDraft}
    resolved={recoveryResolved} disabled={saving || loading} onRestore={restore} onUseServer={useServer} />
  const update = (patch: Partial<EditorQuestion>) =>
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((item) =>
        item.id === question.id ? { ...item, ...patch } : item,
      ),
    }))
  if (loading || needsReload || creationUnknown)
    return (
      <main className="quiz-set-editor__not-found">
        <h1 className="quiz-set-editor__not-found-title">문제 세트 편집</h1>
        {loading ? <p role="status">문제 세트를 불러오는 중입니다.</p> : <p role="alert" className="quiz-set-editor__error">{error}</p>}
        {recoveryPanel}
        {!loading && !creationUnknown && (
          <button type="button" onClick={reload} className="quiz-set-editor__back-button">다시 불러오기</button>
        )}
        <Link className="quiz-set-editor__back-button" to="/professor/sets">
          목록으로 돌아가기
        </Link>
      </main>
    )
  return (
    <main className="quiz-set-editor" aria-busy={saving}>
      {recoveryPanel}
      <fieldset disabled={blocked} className="quiz-set-editor__form">
      <div className="quiz-set-editor__toolbar">
        <input
          aria-label="세트 이름"
          maxLength={50}
          placeholder="새 세트 이름"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="quiz-set-editor__name-input"
        />
        {question && <label className="quiz-set-editor__duration-label">
          <Icon screen="editor" name="imgFrame2" />
          {selectedIndex + 1}번 제한시간
          <input
            aria-label="문제당 시간(초)"
            type="number"
            min={10}
            max={300}
            value={question.seconds}
            onChange={(event) => update({ seconds: Number(event.target.value) })}
            className="quiz-set-editor__duration-input"
          />
          <span className="quiz-set-editor__duration-help">초 · 선택한 문항에 적용 · 10~300초</span>
        </label>}
        <div className="quiz-set-editor__actions">
          <button
            type="button"
            className="quiz-set-editor__cancel-button"
            onClick={() => JSON.stringify(draft) === originalDraft.current
              ? navigate('/professor/sets')
              : setCancelling(true)}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}
            className="quiz-set-editor__visibility-button"
          >
            {draft.isPublic ? '비공개 전환' : '공개 전환'}
          </button>
          <button type="button" onClick={() => void save()} className="quiz-set-editor__save-button">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
      <label className="quiz-set-editor__description-label" htmlFor="set-description">세트 설명</label>
      <textarea id="set-description" value={draft.description}
        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        className="quiz-set-editor__description-input" placeholder="세트 설명을 입력하세요 (선택)" />
      {draft.isPublic && <p role="status" className="quiz-set-editor__public-help">공개하면 학생이 문제와 정답을 복습할 수 있습니다.</p>}
      {saving && <p role="status" className="quiz-set-editor__public-help">변경 내용을 저장하고 있습니다. 완료될 때까지 기다려 주세요.</p>}
      {error && (
        <p role="alert" className="quiz-set-editor__error">
          {error}
        </p>
      )}
      <div className="quiz-set-editor__layout">
        <aside className="quiz-set-editor__sidebar">
          <h2 className="quiz-set-editor__sidebar-title">문항 (드래그로 순서 변경)</h2>
          {draft.questions.map((item, index) => (
            <div
              key={item.id}
              draggable={!blocked}
              onDragStart={(event) => {
                dragId.current = item.id
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', item.id)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (blocked) return
                const source = draft.questions.findIndex((entry) => entry.id === dragId.current)
                if (source < 0 || source === index) return
                const questions = [...draft.questions]
                questions.splice(index, 0, questions.splice(source, 1)[0])
                setDraft({ ...draft, questions })
                dragId.current = null
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-pressed={selectedId === item.id}
                className={`quiz-set-editor__question-button ${selectedId === item.id ? 'quiz-set-editor__question-button--selected' : 'quiz-set-editor__question-button--default'}`}
              >
                <Icon screen="editor" name={selectedId === item.id ? 'imgFrame3' : 'imgFrame4'} />
                <span
                  className={`quiz-set-editor__question-number ${selectedId === item.id ? 'quiz-set-editor__question-number--selected' : 'quiz-set-editor__question-number--default'}`}
                >
                  {index + 1}
                </span>
                <span className="quiz-set-editor__question-name">{item.prompt || '새 문항'}</span>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const item = newQuestion()
              setDraft({ ...draft, questions: [...draft.questions, item] })
              setSelectedId(item.id)
              setError('')
            }}
            className="quiz-set-editor__add-button"
          >
            <Icon screen="editor" name="imgFrame5" />
            문항 추가
          </button>
          <p className="quiz-set-editor__reorder-help">
            순서 변경: 선택한 문항을{' '}
            <button
              type="button"
              className="quiz-set-editor__reorder-button"
              disabled={!question || selectedIndex === 0}
              onClick={() => {
                const questions = [...draft.questions]
                ;[questions[selectedIndex - 1], questions[selectedIndex]] = [
                  questions[selectedIndex],
                  questions[selectedIndex - 1],
                ]
                setDraft({ ...draft, questions })
              }}
            >
              위로
            </button>{' '}
            ·{' '}
            <button
              type="button"
              className="quiz-set-editor__reorder-button"
              disabled={!question || selectedIndex === draft.questions.length - 1}
              onClick={() => {
                const questions = [...draft.questions]
                ;[questions[selectedIndex + 1], questions[selectedIndex]] = [
                  questions[selectedIndex],
                  questions[selectedIndex + 1],
                ]
                setDraft({ ...draft, questions })
              }}
            >
              아래로
            </button>
          </p>
        </aside>
        {question ? <section className="quiz-set-editor__question-panel">
          <h2 className="quiz-set-editor__question-title">{selectedIndex + 1}번 문항 편집</h2>
          <button type="button" className="quiz-set-editor__delete-button" onClick={() => setRemoving(question.id)}>문항 삭제</button>
          <label htmlFor="question-prompt" className="quiz-set-editor__prompt-label">
            문제 내용
          </label>
          <textarea
            id="question-prompt"
            value={question.prompt}
            maxLength={500}
            onChange={(event) => update({ prompt: event.target.value })}
            placeholder="문제 내용을 입력하세요"
            className="quiz-set-editor__prompt-input"
          />
          <div className="quiz-set-editor__type-row">
            <span className="quiz-set-editor__type-label">유형</span>
            <div className="quiz-set-editor__type-switch">
              {(['multiple', 'ox'] as const).map((type) => (
                <button
                  type="button"
                  key={type}
                  aria-pressed={question.type === type}
                  onClick={() => {
                    if (type !== question.type)
                      update({
                        type,
                        options: type === 'ox' ? ['O', 'X'] : ['', '', '', ''],
                        answer: 0,
                      })
                  }}
                  className={`quiz-set-editor__type-button ${question.type === type ? 'quiz-set-editor__type-button--selected' : 'quiz-set-editor__type-button--default'}`}
                >
                  {type === 'multiple' ? '4지선다' : 'OX'}
                </button>
              ))}
            </div>
          </div>
          <fieldset className="quiz-set-editor__options-fieldset">
            <legend className="quiz-set-editor__options-legend">선택지 (정답 라디오로 선택)</legend>
            <div className="quiz-set-editor__options">
              {question.options.map((option, index) => (
                <div
                  key={`${question.id}-${question.type}-${index}`}
                  className="quiz-set-editor__option-row"
                >
                  <input
                    aria-label={`선택지 ${index + 1}을 정답으로 설정`}
                    type="radio"
                    name="correct-answer"
                    checked={question.answer === index}
                    onChange={() => update({ answer: index })}
                    className="quiz-set-editor__answer-radio"
                  />
                  <span className="quiz-set-editor__option-number" data-option-index={index}>
                    {question.type === 'ox' ? option : labels[index]}
                  </span>
                  <input
                    aria-label={`선택지 ${index + 1} 내용`}
                    readOnly={question.type === 'ox'}
                    value={option}
                    maxLength={200}
                    placeholder={`선택지 ${index + 1}`}
                    onChange={(event) =>
                      update({
                        options: question.options.map((value, optionIndex) =>
                          optionIndex === index ? event.target.value : value,
                        ),
                      })
                    }
                    className={`quiz-set-editor__option-input ${question.answer === index ? 'quiz-set-editor__option-input--correct' : ''}`}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        </section> : <section className="quiz-set-editor__question-panel"><p>문항이 없습니다. 문항 추가 버튼으로 새 문항을 작성해 주세요.</p></section>}
      </div>
      </fieldset>
      {removing && (
        <ConfirmDialog title="문항을 삭제할까요?" message="저장 버튼을 누르면 서버에서도 삭제됩니다."
          cancelLabel="취소" confirmLabel="문항 삭제" onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const questions = draft.questions.filter((item) => item.id !== removing)
            setDraft({ ...draft, questions })
            setSelectedId(questions[0]?.id ?? '')
            setRemoving(null)
          }} />
      )}
      {cancelling && (
        <ConfirmDialog
          title="편집을 취소할까요?"
          message="저장하지 않은 변경 내용은 사라집니다."
          cancelLabel="계속 편집"
          confirmLabel="변경 내용 버리기"
          onCancel={() => setCancelling(false)}
          onConfirm={() => navigate('/professor/sets')}
        />
      )}
    </main>
  )
}
