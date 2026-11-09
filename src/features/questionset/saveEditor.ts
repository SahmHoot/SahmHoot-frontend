import type * as api from './api'
import type { EditorDraft } from './editorDraft'
import { questionRequest } from './editorDraft'
import type { Visibility } from './questionset.types'

type EditorApi = Pick<typeof api, 'createQuestionSet' | 'updateQuestionSet' | 'addQuestion' | 'updateQuestion' | 'deleteQuestion' | 'reorderQuestions'>

export interface SaveCheckpoint {
  setId?: number
  questionIds: number[]
  /** POST 전 설정하고 성공 응답 후 해제. 응답 유실 시 POST 재전송 금지. */
  creating: boolean
  visibility?: Visibility
  createdIds?: Record<string, number>
  /** 성공 여부가 확인되지 않은 문항 POST. 재조회 전 재전송하지 않는다. */
  pendingQuestionId?: string
}

/** 요청들은 개별 트랜잭션이다. 호출 측은 실패 후 반드시 상세를 재조회한다. */
export async function saveEditor(draft: EditorDraft, checkpoint: SaveCheckpoint, client: EditorApi) {
  if (checkpoint.creating) throw new Error('생성 결과를 먼저 확인해 주세요.')
  if (checkpoint.pendingQuestionId) throw new Error('문항 생성 결과를 먼저 확인해 주세요.')
  checkpoint.createdIds = {}
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
    const request = questionRequest(question)
    if (question.serverId === undefined) checkpoint.pendingQuestionId = question.id
    const saved = question.serverId === undefined ? await client.addQuestion(setId, request)
      : await client.updateQuestion(setId, question.serverId, request)
    if (question.serverId === undefined) checkpoint.createdIds[question.id] = saved.id
    checkpoint.pendingQuestionId = undefined
    orderedIds.push(saved.id)
  }
  await client.reorderQuestions(setId, { questionIds: orderedIds })
  if (draft.isPublic && checkpoint.visibility !== 'PUBLIC') {
    await client.updateQuestionSet(setId, { visibility: 'PUBLIC' })
    checkpoint.visibility = 'PUBLIC'
  }
  return setId
}
