import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '../../shared/components/Button'
import { useImagePreview } from '../../shared/hooks/useImagePreview'
import { imageErrorMessage, toQuestionSetApiError } from './api'
import type { EditorQuestion } from './editorDraft'
import { validateImageFile } from './questionImage'
import type { ImageChange } from './questionImage'

export function QuestionImageField({ question, onChange, onChecking }: {
  question: EditorQuestion
  onChange: (change: ImageChange | undefined) => void
  onChecking: Dispatch<SetStateAction<string | undefined>>
}) {
  const input = useRef<HTMLInputElement>(null)
  const selection = useRef(0)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const change = question.imageChange
  const source = change?.kind === 'attach' ? change.file : change ? undefined : question.image?.url
  const { preview, retry } = useImagePreview(source)

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
  return (
    <div className="mt-3 space-y-2">
      <input ref={input} type="file" accept="image/jpeg,image/png" aria-label="문항 이미지 파일" hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void choose(file)
        }} />
      {preview && preview.status === 'ready' && (
        <img src={preview.url} alt="문항 이미지 미리보기"
          className="block max-h-40 max-w-full rounded-md border border-border object-contain" />
      )}
      {preview && preview.status === 'loading' && <p role="status" className="text-xs text-hoot-muted">이미지를 불러오는 중입니다.</p>}
      {preview && preview.status === 'error' && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="quiz-set-editor__field-error">
            {imageErrorMessage(toQuestionSetApiError(preview.error), '이미지를 불러올 수 없습니다.')}
          </p>
          <Button size="sm" variant="outline" onClick={retry}>이미지 다시 불러오기</Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => input.current?.click()}>
          {source ? '이미지 교체' : '이미지 첨부'}
        </Button>
        {source && <Button size="sm" variant="danger" onClick={() => apply(question.image ? { kind: 'remove' } : undefined)}>이미지 제거</Button>}
        {(change?.kind === 'remove' || (change?.kind === 'attach' && question.image)) &&
          <Button size="sm" variant="outline" onClick={() => apply(undefined)}>이미지 변경 취소</Button>}
      </div>
      {checking && <p role="status" className="text-xs text-hoot-muted">선택한 이미지를 확인하는 중입니다.</p>}
      {change?.kind === 'remove' && <p role="status" className="text-xs text-hoot-muted">저장하면 이미지가 제거됩니다.</p>}
      {change?.kind === 'attach' && <p className="break-all text-xs text-hoot-muted">{change.file.name} · 저장 시 업로드</p>}
      {error && <p role="alert" className="quiz-set-editor__field-error">{error}</p>}
    </div>
  )
}
