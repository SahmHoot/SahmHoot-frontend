import type { EditorDraft } from './editorDraft'
import { planRecovery } from './editorRecovery'
import type { EditorRecovery } from './editorRecovery'

export function EditorRecoveryPanel({ recovery, server, resolved, disabled, onRestore, onUseServer }: {
  recovery: EditorRecovery | null
  server: EditorDraft | null
  resolved: boolean
  disabled: boolean
  onRestore: () => void
  onUseServer: () => void
}) {
  if (!recovery) return null
  const plan = server ? planRecovery(recovery, server) : null
  const labels = { saved: '서버 내용과 일치', unsaved: '미저장 변경', uncertain: '확인 필요' }
  return (
    <section className="quiz-set-editor__recovery" aria-label="저장 실패 복구">
      <h2>저장 전 초안을 보관했습니다</h2>
      <p>{!server ? '초안을 보존했습니다. 서버 상태를 확인하기 전에는 자동으로 복원하거나 다시 저장하지 않습니다.'
        : resolved ? '선택한 내용으로 편집할 수 있습니다. 보존 초안도 계속 확인할 수 있습니다.'
          : '아래 편집기는 서버에서 확인한 내용입니다. 보존 초안과 비교한 뒤 복구 방법을 선택해 주세요.'}</p>
      <details>
        <summary>저장 전 초안 확인</summary>
        <p className="quiz-set-editor__recovery-text">제목: {recovery.draft.name}</p>
        <p className="quiz-set-editor__recovery-text">설명: {recovery.draft.description || '(없음)'}</p>
        <p>공개 여부: {recovery.draft.isPublic ? '공개' : '비공개'}</p>
        <ol>
          {recovery.draft.questions.map((question, index) => (
            <li key={question.id}>
              <p className="quiz-set-editor__recovery-text">{index + 1}. {question.prompt}</p>
              <p>{question.seconds}초 · {plan ? labels[plan.statuses[index]] : '서버 확인 전'}</p>
              <ul>{question.options.map((option, optionIndex) => (
                <li key={optionIndex} className="quiz-set-editor__recovery-text">
                  {optionIndex + 1}. {option}{question.answer === optionIndex ? ' (정답)' : ''}
                </li>
              ))}</ul>
            </li>
          ))}
        </ol>
      </details>
      {plan && !plan.restored && (
        <p>생성 결과가 불명확하거나 서버에서 사라진 문항이 있어 일괄 복원을 막았습니다. 서버 상태를 선택한 뒤 필요한 내용을 직접 수정해 주세요. 문항을 새로 추가하면 중복될 수 있습니다.</p>
      )}
      {server && (
        <div className="quiz-set-editor__actions">
          <button type="button" className="quiz-set-editor__cancel-button" disabled={disabled} onClick={onUseServer}>서버 상태로 편집</button>
          <button type="button" className="quiz-set-editor__save-button" disabled={disabled || !plan?.restored} onClick={onRestore}>초안 변경 복원</button>
        </div>
      )}
      <p>확인되지 않은 생성 요청은 자동으로 다시 보내지 않습니다. 보존 초안을 직접 복사해 둘 수도 있습니다.</p>
    </section>
  )
}
