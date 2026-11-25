import type * as api from './api'
import type { EditorDraft, EditorQuestion } from './editorDraft'
import { questionRequest } from './editorDraft'
import type { Visibility } from './questionset.types'

type EditorApi = Pick<typeof api, 'createQuestionSet' | 'updateQuestionSet' | 'addQuestion' | 'updateQuestion' | 'deleteQuestion' | 'reorderQuestions' | 'uploadQuestionImage' | 'toQuestionSetApiError'>

export interface SaveCheckpoint {
  setId?: number
  questionIds: number[]
  /** POST 전 설정하고 성공 응답 후 해제. 응답 유실 시 POST 재전송 금지. */
  creating: boolean
  visibility?: Visibility
  createdIds?: Record<string, number>
  /** 성공 여부가 확인되지 않은 문항 POST. 재조회 전 재전송하지 않는다. */
  pendingQuestionId?: string
  uploadingQuestionId?: string
}

async function saveQuestion(question: EditorQuestion, setId: number, checkpoint: SaveCheckpoint, client: EditorApi,
  onUpload?: (questionId: string | undefined) => void) {
  const change = question.imageChange
  const send = async () => {
    const request = questionRequest(question)
    if (change?.kind === 'remove' && question.serverId !== undefined) request.imageRef = null
    if (change?.kind === 'attach') {
      if (!change.upload || Date.parse(change.upload.expiresAt) <= Date.now()) {
        checkpoint.uploadingQuestionId = question.id
        onUpload?.(question.id)
        try { change.upload = await client.uploadQuestionImage(setId, change.file) }
        finally { onUpload?.(undefined) }
        checkpoint.uploadingQuestionId = undefined
      }
      request.imageRef = change.upload.imageRef
    }
    if (question.serverId === undefined) {
      checkpoint.pendingQuestionId = question.id
      return client.addQuestion(setId, request)
    }
    return client.updateQuestion(setId, question.serverId, request)
  }
  const saved = await send().catch((cause: unknown) => {
    if (checkpoint.uploadingQuestionId || change?.kind !== 'attach'
      || client.toQuestionSetApiError(cause).code !== 'QUESTION_IMAGE_NOT_AVAILABLE') throw cause
    // 만료되었거나 이전 응답 유실로 소비된 참조는 파일로 한 번 갱신한다.
    checkpoint.pendingQuestionId = undefined
    change.upload = undefined
    return send()
  })
  if (question.serverId === undefined) (checkpoint.createdIds ??= {})[question.id] = saved.id
  checkpoint.pendingQuestionId = undefined
  if (change) {
    question.image = saved.image
    question.imageChange = undefined
  }
  return saved.id
}

/** 요청들은 개별 트랜잭션이다. 호출 측은 실패 후 반드시 상세를 재조회한다. */
export async function saveEditor(draft: EditorDraft, checkpoint: SaveCheckpoint, client: EditorApi,
  onUpload?: (questionId: string | undefined) => void) {
  if (checkpoint.creating) throw new Error('생성 결과를 먼저 확인해 주세요.')
  if (checkpoint.pendingQuestionId) throw new Error('문항 생성 결과를 먼저 확인해 주세요.')
  checkpoint.createdIds = {}
  checkpoint.uploadingQuestionId = undefined
  const metadata = { title: draft.name.trim(), description: draft.description || null }
  if (checkpoint.setId === undefined) {
    checkpoint.creating = true
    const created = await client.createQuestionSet({ ...metadata, visibility: 'PRIVATE' })
    checkpoint.setId = created.id
    checkpoint.creating = false
    checkpoint.visibility = 'PRIVATE'
  } else {
    // PATCH에서 visibility 생략은 기존 공개 여부 유지다. 공개 전환은 마지막에 한다.
    await client.updateQuestionSet(checkpoint.setId, draft.isPublic ? metadata : { ...metadata, visibility: 'PRIVATE' })
    if (!draft.isPublic) checkpoint.visibility = 'PRIVATE'
  }
  const setId = checkpoint.setId
  const retained = new Set(draft.questions.flatMap((question) => question.serverId === undefined ? [] : [question.serverId]))
  for (const id of checkpoint.questionIds) {
    if (!retained.has(id)) await client.deleteQuestion(setId, id)
  }
  const orderedIds: number[] = []
  for (const question of draft.questions) {
    orderedIds.push(await saveQuestion(question, setId, checkpoint, client, onUpload))
  }
  await client.reorderQuestions(setId, { questionIds: orderedIds })
  if (draft.isPublic && checkpoint.visibility !== 'PUBLIC') {
    await client.updateQuestionSet(setId, { visibility: 'PUBLIC' })
    checkpoint.visibility = 'PUBLIC'
  }
  return setId
}
