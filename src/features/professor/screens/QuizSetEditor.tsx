import './QuizSetEditor.css'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useHref, useNavigate, useParams } from 'react-router-dom'
import { isInvalidOption, newQuestion } from '../../questionset/editorDraft'
import type { DraftField, EditorQuestion } from '../../questionset/editorDraft'
import { useQuestionSetEditor } from '../../questionset/useQuestionSetEditor'
import { EditorRecoveryPanel } from '../../questionset/EditorRecoveryPanel'
import { QuestionImageField } from '../../questionset/QuestionImageField'
import { getRoomTab, roomSetCancelled, roomSetSaved } from '../roomSetReturn'
import { labels } from '../dashboard-quiz'
import { Icon } from '../components/Icon'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'

const errorTargets = {
  name: 'set-name',
  description: 'set-description',
  seconds: 'question-duration',
  prompt: 'question-prompt',
  options: 'question-options',
} satisfies Record<DraftField, string>

export function QuizSetEditor() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const roomPath = useHref('/professor/room')
  const [finished, setFinished] = useState<'saved' | 'cancelled' | null>(null)
  const finish = (result: 'saved' | 'cancelled') => {
    setFinished(result)
    const room = getRoomTab(roomPath)
    if (!room) return
    room.postMessage(result === 'saved' ? roomSetSaved : roomSetCancelled, window.location.origin)
    room.focus()
    window.close()
  }
  const { draft, setDraft, selectedId, setSelectedId, loading, saving, uploadingQuestionId, error, setError, fieldErrors, fromRoom,
    needsReload, creationUnknown, save, reload, originalDraft, recovery, recoveryResolved,
    serverDraft, restore, useServer, creationCandidates, checkCreation, selectCreatedSet, resolveImageQuestion } = useQuestionSetEditor(setId, () => {
    if (fromRoom) finish('saved')
    else navigate('/professor/sets', { replace: true })
  })
  const cancel = () => {
    if (fromRoom) finish('cancelled')
    else navigate('/professor/sets')
  }
  const [cancelling, setCancelling] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [checkingImageId, setCheckingImageId] = useState<string>()
  const dragId = useRef<string | null>(null)
  const selectedIndex = Math.max(
    0,
    draft.questions.findIndex((question) => question.id === selectedId),
  )
  const question = draft.questions[selectedIndex]
  const checkingImage = checkingImageId !== undefined
  const [focusRequest, setFocusRequest] = useState(0)
  const handledFocusRequest = useRef(0)
  const messageFor = (field: DraftField) => fieldErrors.find((error) =>
    error.field === field && (!error.questionId || error.questionId === question?.id))?.message
  const optionError = messageFor('options')
  const firstInvalidOption = optionError ? question?.options.findIndex(isInvalidOption) : undefined
  const focusField = fieldErrors.find((error) => !error.questionId || error.questionId === question?.id)?.field
  useLayoutEffect(() => {
    if (focusRequest === handledFocusRequest.current) return
    handledFocusRequest.current = focusRequest
    if (!focusField) return
    const fieldId = focusField === 'options' && firstInvalidOption !== undefined && firstInvalidOption >= 0
      ? `question-option-${firstInvalidOption}` : errorTargets[focusField]
    const field = document.getElementById(fieldId)
    field?.focus({ preventScroll: true })
    field?.scrollIntoView({ block: 'center' })
  }, [focusField, focusRequest, firstInvalidOption])
  const invalidProps = (field: DraftField) => ({
    'aria-invalid': messageFor(field) ? true : undefined,
    'aria-describedby': messageFor(field) ? `${errorTargets[field]}-error` : undefined,
  })
  const feedback = (field: DraftField) => {
    const message = messageFor(field)
    return message && <span id={`${errorTargets[field]}-error`} role="alert"
      className={field === 'options' ? 'quiz-set-editor__field-error quiz-set-editor__field-error--inline' : 'quiz-set-editor__field-error'}>{message}</span>
  }
  const submit = () => {
    if (checkingImage) return
    void save()
    setFocusRequest((request) => request + 1)
  }
  const blocked = saving || Boolean(recovery && !recoveryResolved)
  const recoveryPanel = <EditorRecoveryPanel recovery={recovery} server={needsReload || creationUnknown ? null : serverDraft}
    resolved={recoveryResolved} disabled={saving || loading} onRestore={restore} onUseServer={useServer} onResolveImageQuestion={resolveImageQuestion} />
  const update = (patch: Partial<EditorQuestion>) =>
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((item) =>
        item.id === question.id ? { ...item, ...patch } : item,
      ),
    }))
  if (finished) return (
    <main className="quiz-set-editor__not-found">
      <h1 className="quiz-set-editor__not-found-title">{finished === 'saved' ? '문제 세트를 저장했습니다.' : '편집을 취소했습니다.'}</h1>
      <p>브라우저에서 수업 탭을 선택하거나 이 탭을 직접 닫아 주세요.</p>
      <p>수업 탭을 이미 닫았다면 교수 홈에서 수업을 다시 열어 주세요.</p>
      <Link className="quiz-set-editor__back-button" to="/professor">교수 홈</Link>
    </main>
  )
  if (loading || needsReload || creationUnknown)
    return (
      <main className="quiz-set-editor__not-found">
        <h1 className="quiz-set-editor__not-found-title">문제 세트 편집</h1>
        {loading ? <p role="status">문제 세트를 불러오는 중입니다.</p> : <p role="alert" className="quiz-set-editor__error">{error}</p>}
        {recoveryPanel}
        {creationUnknown && <>
          <button type="button" disabled={saving} onClick={() => void checkCreation()} className="quiz-set-editor__back-button">생성 결과 다시 확인</button>
          <p>후보 내용을 확인한 뒤 생성된 세트를 선택해 주세요. 다른 세트일 수 있으므로 자동으로 연결하지 않습니다.</p>
          {creationCandidates.map((item) => <div key={item.id}>
            <Link to={`/professor/sets/${item.id}`}>{item.title} (#{item.id}) 확인</Link>
            <button type="button" disabled={saving} onClick={() => selectCreatedSet(item.id)}>이 세트에 초안 연결</button>
          </div>)}
        </>}
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
        <div className="quiz-set-editor__name-field">
          <input
            id="set-name"
            {...invalidProps('name')}
            aria-describedby={messageFor('name') ? 'set-name-help set-name-error' : 'set-name-help'}
            aria-label="세트 이름"
            maxLength={50}
            placeholder="세트 이름을 입력하세요"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="quiz-set-editor__name-input"
          />
          <p id="set-name-help" className="quiz-set-editor__name-help">문제 세트 이름을 50자 이내로 입력하세요.</p>
          {feedback('name')}
        </div>
        {question && <div className="quiz-set-editor__duration-field">
          <label className="quiz-set-editor__duration-label">
            <Icon screen="editor" name="imgFrame2" />
            {selectedIndex + 1}번 제한시간
            <input
              id="question-duration"
              {...invalidProps('seconds')}
              aria-label="문제당 시간(초)"
              type="number"
              min={10}
              max={300}
              value={question.seconds}
              onChange={(event) => update({ seconds: Number(event.target.value) })}
              className="quiz-set-editor__duration-input"
            />
            <span className="quiz-set-editor__duration-help">초 · 선택한 문항에 적용 · 10~300초</span>
          </label>
          {feedback('seconds')}
        </div>}
        <div className="quiz-set-editor__actions">
          <button
            type="button"
            role="switch"
            aria-label="문제 세트 공개 여부"
            aria-checked={draft.isPublic}
            onClick={() => setDraft({ ...draft, isPublic: !draft.isPublic })}
            className="quiz-set-editor__visibility-button"
          >
            <span className="quiz-set-editor__visibility-label">{draft.isPublic ? '공개' : '비공개'}</span>
            <span aria-hidden="true" className="quiz-set-editor__visibility-track" />
          </button>
          <button
            type="button"
            className="quiz-set-editor__cancel-button"
            onClick={() => JSON.stringify(draft) === originalDraft.current
              ? cancel()
              : setCancelling(true)}
          >
            취소
          </button>
          <button type="button" onClick={submit} disabled={checkingImage} className="quiz-set-editor__save-button">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
      <label className="quiz-set-editor__description-label" htmlFor="set-description">세트 설명</label>
      <textarea id="set-description" value={draft.description} maxLength={1000} {...invalidProps('description')}
        aria-describedby={messageFor('description') ? 'set-description-help set-description-error' : 'set-description-help'}
        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        className="quiz-set-editor__description-input" placeholder="세트 설명을 입력하세요 (선택)" />
      {feedback('description')}
      <p id="set-description-help" className="quiz-set-editor__public-help">설명은 공백 포함 최대 1000자입니다. ({draft.description.length}/1000)</p>
      {saving && <p role="status" className="quiz-set-editor__public-help">{uploadingQuestionId
        ? `${draft.questions.findIndex((item) => item.id === uploadingQuestionId) + 1}번 문항 이미지를 업로드하는 중입니다.`
        : '변경 내용을 저장하고 있습니다. 완료될 때까지 기다려 주세요.'}</p>}
      {error && (
        <p role="alert" className="quiz-set-editor__error">
          {error}
        </p>
      )}
      <div className="quiz-set-editor__layout">
        <aside className="quiz-set-editor__sidebar">
          <h2 className="quiz-set-editor__sidebar-title">문항 (드래그로 순서 변경)</h2>
          {draft.questions.map((item, index) => {
            const hasError = fieldErrors.some((error) => error.questionId === item.id)
            return (
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
                  disabled={checkingImage}
                  onClick={() => setSelectedId(item.id)}
                  aria-pressed={selectedId === item.id}
                  aria-description={hasError ? '필수 입력 오류가 있는 문항' : undefined}
                  className={`quiz-set-editor__question-button ${selectedId === item.id ? 'quiz-set-editor__question-button--selected' : 'quiz-set-editor__question-button--default'}`}
                >
                  <Icon screen="editor" name={selectedId === item.id ? 'imgFrame3' : 'imgFrame4'} />
                  <span
                    className={`quiz-set-editor__question-number ${selectedId === item.id ? 'quiz-set-editor__question-number--selected' : 'quiz-set-editor__question-number--default'}`}
                  >
                    <span className="quiz-set-editor__question-digit">{index + 1}</span>
                  </span>
                  <span className="quiz-set-editor__question-name">{item.prompt || '새 문항'}</span>
                  <span className="quiz-set-editor__question-error-icon" data-error-icon={hasError || undefined} aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7.5" stroke="currentColor" />
                      <path d="M8 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="11" r=".75" fill="currentColor" />
                    </svg>
                  </span>
                </button>
              </div>
            )
          })}
          <button
            type="button"
            disabled={checkingImage}
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
          <div className="quiz-set-editor__question-head">
            <h2 className="quiz-set-editor__question-title">{selectedIndex + 1}번 문항 편집</h2>
            <button type="button" className="quiz-set-editor__delete-button" disabled={checkingImage} onClick={() => setRemoving(question.id)}>문항 삭제</button>
          </div>
          <label htmlFor="question-prompt" className="quiz-set-editor__prompt-label">
            문제 내용
          </label>
          <div className="quiz-set-editor__prompt-box" data-invalid={messageFor('prompt') ? 'true' : undefined}>
          <textarea
            id="question-prompt"
            {...invalidProps('prompt')}
            value={question.prompt}
            maxLength={500}
            onChange={(event) => update({ prompt: event.target.value })}
            placeholder="문제 내용을 입력하세요"
            className="quiz-set-editor__prompt-input"
          />
          {feedback('prompt') && <div className="quiz-set-editor__prompt-error">{feedback('prompt')}</div>}
          <QuestionImageField key={question.id} question={question}
            onChange={(imageChange) => update({ imageChange })}
            onChecking={setCheckingImageId} />
          </div>
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
          <fieldset id="question-options" tabIndex={-1} {...invalidProps('options')}
            className="quiz-set-editor__options-fieldset">
            <legend className="quiz-set-editor__options-legend">
              선택지 (정답 라디오로 선택){feedback('options')}
            </legend>
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
                  <div className="quiz-set-editor__option-field">
                    <input
                      id={`question-option-${index}`}
                      aria-invalid={optionError && isInvalidOption(option) ? true : undefined}
                      aria-describedby={optionError && isInvalidOption(option) ? 'question-options-error' : undefined}
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
          onConfirm={cancel}
        />
      )}
    </main>
  )
}
