import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '../../shared/components/Button'
import { useImagePreview } from '../../shared/hooks/useImagePreview'
import { imageErrorMessage, toQuestionSetApiError } from './api'
import type { EditorQuestion } from './editorDraft'
import { validateImageFile } from './questionImage'
import type { ImageChange } from './questionImage'

type FocusTarget = 'cancel' | 'attach' | 'attach-if-lost'

export function QuestionImageField({ question, onChange, onChecking }: {
  question: EditorQuestion
  onChange: (change: ImageChange | undefined) => void
  onChecking: Dispatch<SetStateAction<string | undefined>>
}) {
  const input = useRef<HTMLInputElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const [focusTarget, setFocusTarget] = useState<FocusTarget>()
  const selection = useRef(0)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const change = question.imageChange
  const source = change?.kind === 'attach' ? change.file : change ? undefined : question.image?.url
  const { preview, retry } = useImagePreview(source)

  // 누른 버튼이 사라지거나 검사 중 비활성화되면 포커스가 body로 빠지므로 남아 있는 버튼으로 옮긴다.
  useEffect(() => {
    if (!focusTarget) return
    setFocusTarget(undefined)
    const active = document.activeElement
    if (focusTarget === 'attach-if-lost' && active && active !== document.body) return
    field.current?.querySelector<HTMLButtonElement>(focusTarget === 'cancel' ? '[data-image-cancel]' : '[data-image-attach]')?.focus()
  }, [focusTarget])

  useEffect(() => () => {
    selection.current++
    onChecking((current) => current === question.id ? undefined : current)
  }, [onChecking, question.id])

  const choose = async (file: File) => {
    const selected = ++selection.current
    setChecking(true)
    onChecking(question.id)
    setError('')
    try {
      await validateImageFile(file)
      if (selected === selection.current) onChange({ kind: 'attach', file })
    } catch (cause: unknown) {
      if (selected === selection.current) setError(cause instanceof Error ? cause.message : '이미지를 확인할 수 없습니다.')
    } finally {
      if (selected === selection.current) {
        setChecking(false)
        onChecking(undefined)
        setFocusTarget('attach-if-lost')
      }
    }
  }
  const apply = (next: ImageChange | undefined) => {
    selection.current++
    setChecking(false)
    onChecking(undefined)
    setError('')
    onChange(next)
  }
  const cancellable = change?.kind === 'remove' || (change?.kind === 'attach' && Boolean(question.image))
  return (
    <div ref={field} className="question-image-field">
      <input ref={input} type="file" accept="image/jpeg,image/png" aria-label="문항 이미지 파일" hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void choose(file)
        }} />
      {preview && preview.status === 'ready' && (
        <figure className="question-image-field__figure">
          <img src={preview.url} alt="문항 이미지 미리보기" className="question-image-field__image" />
        </figure>
      )}
      {preview && preview.status === 'loading' && <p role="status" className="question-image-field__state">이미지를 불러오는 중입니다.</p>}
      {preview && preview.status === 'error' && (
        <div className="question-image-field__state">
          <p role="alert" className="quiz-set-editor__field-error">
            {imageErrorMessage(toQuestionSetApiError(preview.error), '이미지를 불러올 수 없습니다.')}
          </p>
          <Button size="sm" variant="outline" onClick={retry}>이미지 다시 불러오기</Button>
        </div>
      )}
      <div className="question-image-field__footer">
        <div className="question-image-field__messages">
          {checking && <p role="status">선택한 이미지를 확인하는 중입니다.</p>}
          {change?.kind === 'remove' && <p role="status">저장하면 이미지가 제거됩니다.</p>}
          {change?.kind === 'attach' && <p className="break-all">{change.file.name} · 저장 시 업로드</p>}
          {error && <p role="alert" className="quiz-set-editor__field-error">{error}</p>}
        </div>
        {cancellable && <Button data-image-cancel size="sm" variant="outline" onClick={() => {
          apply(undefined)
          setFocusTarget('attach')
        }}>이미지 변경 취소</Button>}
        <Button data-image-attach size="sm" variant="outline" disabled={checking} onClick={() => input.current?.click()}>
          {!source && <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5-5-9 8" />
          </svg>}
          {source ? '이미지 교체' : '이미지 첨부'}
        </Button>
        {source && <Button size="sm" variant="danger" onClick={() => {
          apply(question.image ? { kind: 'remove' } : undefined)
          setFocusTarget(question.image ? 'cancel' : 'attach')
        }}>이미지 제거</Button>}
      </div>
    </div>
  )
}
