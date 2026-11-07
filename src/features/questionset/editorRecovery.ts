import type { EditorDraft } from './editorDraft'
import { questionRequest } from './editorDraft'
import type { SaveCheckpoint } from './saveEditor'

export interface EditorRecovery {
  version: 1
  setId?: number
  draft: EditorDraft
  originalQuestionIds: number[]
  createdIds: Record<string, number>
  uncertainQuestionId?: string
  creationUnknown: boolean
}

// 401의 로그인 이동은 route state를 버린다. 같은 탭의 재로그인 동안만,
// 계정별로 초안을 보관하며 토큰이나 인증 저장소에는 접근하지 않는다.
const interruptedDrafts = new Map<string, EditorRecovery>()

export function interruptedDraft(userId: number | undefined, routeId: string | undefined): EditorRecovery | null {
  return userId === undefined ? null : interruptedDrafts.get(`${userId}:${routeId}`) ?? null
}

export function rememberInterruptedDraft(userId: number | undefined, routeId: string | undefined, recovery: EditorRecovery): void {
  if (userId !== undefined) interruptedDrafts.set(`${userId}:${routeId}`, structuredClone(recovery))
}

export function forgetInterruptedDraft(userId: number | undefined, routeId: string | undefined): void {
  interruptedDrafts.delete(`${userId}:${routeId}`)
}

export function preserveDraft(draft: EditorDraft, originalQuestionIds: number[], checkpoint: SaveCheckpoint): EditorRecovery {
  return structuredClone({ version: 1, setId: checkpoint.setId, draft, originalQuestionIds,
    createdIds: checkpoint.createdIds ?? {}, uncertainQuestionId: checkpoint.pendingQuestionId,
    creationUnknown: checkpoint.creating && checkpoint.setId === undefined })
}

/** route state만 사용한다. 목록/인증 저장소와 연결하지 않는다. */
export function recoveryFromRoute(state: unknown, setId: number | undefined): EditorRecovery | null {
  if (!state || typeof state !== 'object' || !('questionSetRecovery' in state)) return null
  const recovery = state.questionSetRecovery as EditorRecovery | null
  return recovery?.version === 1 && recovery.setId === setId ? recovery : null
}

export function recoveryPath(recovery: EditorRecovery): string {
  return `/professor/sets/${recovery.setId ?? 'new'}`
}

export function planRecovery(recovery: EditorRecovery, server: EditorDraft) {
  const statuses = recovery.draft.questions.map((question) => {
    const id = question.serverId ?? recovery.createdIds[question.id]
    if (question.id === recovery.uncertainQuestionId) return 'uncertain' as const
    if (id === undefined) return 'unsaved' as const
    const saved = server.questions.find((item) => item.serverId === id)
    if (!saved) return 'uncertain' as const
    return JSON.stringify(questionRequest(question)) === JSON.stringify(questionRequest(saved))
      ? 'saved' as const : 'unsaved' as const
  })
  if (statuses.includes('uncertain')) return { statuses, restored: null }
  const questions = recovery.draft.questions.map((question) => {
    const serverId = question.serverId ?? recovery.createdIds[question.id]
    return serverId === undefined ? question : { ...question, id: `server:${serverId}`, serverId }
  })
  // 다른 요청이 추가한 문항을 초안 복원으로 삭제하지 않는다.
  const desiredIds = new Set(questions.map((question) => question.serverId))
  const originalIds = new Set(recovery.originalQuestionIds)
  const extras = server.questions.filter((question) => question.serverId !== undefined
    && !desiredIds.has(question.serverId) && !originalIds.has(question.serverId))
  return { statuses, restored: structuredClone({ ...recovery.draft, questions: [...questions, ...extras] }) }
}
