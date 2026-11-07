import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import * as api from './api'
import { fromDetail, newQuestion, validateDraft } from './editorDraft'
import type { EditorDraft } from './editorDraft'
import { saveEditor } from './saveEditor'
import type { SaveCheckpoint } from './saveEditor'
import { forgetInterruptedDraft, interruptedDraft, planRecovery, preserveDraft, recoveryFromRoute, recoveryPath, rememberInterruptedDraft } from './editorRecovery'
import type { EditorRecovery } from './editorRecovery'
import { lockEditorNavigation } from './editorNavigation'

export function useQuestionSetEditor(routeId: string | undefined, onSaved: () => void) {
  const isNew = routeId === 'new'
  const validId = routeId !== undefined && /^[1-9]\d*$/.test(routeId) && Number.isSafeInteger(Number(routeId))
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [initialRecovery] = useState(() => isNew || validId ? interruptedDraft(user?.id, routeId)
    ?? recoveryFromRoute(location.state, validId ? Number(routeId) : undefined) : null)
  const existing = !isNew || initialRecovery?.setId !== undefined
  const [draft, setDraft] = useState<EditorDraft>(() => ({ name: '', description: '', isPublic: false, questions: [newQuestion()] }))
  const [selectedId, setSelectedId] = useState(draft.questions[0]?.id ?? '')
  const [loading, setLoading] = useState(existing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(initialRecovery?.creationUnknown
    ? '세트 생성 결과를 확인할 수 없습니다. 목록에서 생성 여부를 확인해 주세요. 다른 탭이나 새 주소에서 다시 생성하면 중복될 수 있습니다.' : '')
  const [needsReload, setNeedsReload] = useState(existing)
  const [creationUnknown, setCreationUnknown] = useState(initialRecovery?.creationUnknown ?? false)
  const [recovery, setRecovery] = useState<EditorRecovery | null>(initialRecovery)
  const [recoveryResolved, setRecoveryResolved] = useState(false)
  const [serverDraft, setServerDraft] = useState<EditorDraft | null>(existing ? null : draft)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const checkpoint = useRef<SaveCheckpoint>({ setId: initialRecovery?.setId ?? (validId ? Number(routeId) : undefined), questionIds: [], creating: false })
  const originalDraft = useRef(JSON.stringify(draft))
  const working = useRef(false)
  const mounted = useRef(true)

  const install = useCallback((detail: Awaited<ReturnType<typeof api.getQuestionSet>>) => {
    const next = fromDetail(detail)
    checkpoint.current.questionIds = detail.questions.map((question) => question.id)
    checkpoint.current.visibility = detail.visibility
    checkpoint.current.pendingQuestionId = undefined
    setServerDraft(next)
    setDraft(next)
    setSelectedId(next.questions[0]?.id ?? '')
    originalDraft.current = JSON.stringify(next)
    setNeedsReload(false)
  }, [])

  useEffect(() => {
    if (!existing && loadAttempt === 0) return
    const id = checkpoint.current.setId
    if (id === undefined) {
      setError('올바른 문제 세트 주소가 아닙니다.')
      setLoading(false)
      return
    }
    let active = true
    api.getQuestionSet(id).then((detail) => {
      if (active) install(detail)
    }).catch((cause: unknown) => {
      if (active) setError(api.toQuestionSetApiError(cause).message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [existing, loadAttempt, install])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const save = async () => {
    if (working.current || needsReload || creationUnknown || (recovery && !recoveryResolved)) return
    const invalid = validateDraft(draft)
    if (invalid) {
      setError(invalid.message)
      if (invalid.questionId) setSelectedId(invalid.questionId)
      return
    }
    working.current = true
    const unlock = lockEditorNavigation()
    const submitted = structuredClone(draft)
    const originalQuestionIds = [...checkpoint.current.questionIds]
    let recovered: EditorRecovery | undefined
    let complete = false
    setSaving(true)
    setError('')
    try {
      const savedId = await saveEditor(submitted, checkpoint.current, api)
      // 최종 상세 조회까지 완료된 뒤 이동한다.
      install(await api.getQuestionSet(savedId))
      forgetInterruptedDraft(user?.id, routeId)
      complete = true
    } catch (cause: unknown) {
      const failure = api.toQuestionSetApiError(cause)
      const fields = failure.fieldErrors?.map((field) => field.message).join(' ') ?? ''
      const message = `${failure.message} ${fields}`.trim()
      const rejected = [400, 401, 403, 404, 409, 422].includes(failure.status)
      if (rejected) checkpoint.current.pendingQuestionId = undefined
      if (failure.status === 401) {
        // AuthProvider가 이미 편집기를 언마운트했어도 보존한다.
        // 인증 없이 재조회하거나 복구 주소로 로그인 이동을 덮어쓰지 않는다.
        checkpoint.current.creating = false
        recovered = preserveDraft(submitted, originalQuestionIds, checkpoint.current)
        rememberInterruptedDraft(user?.id, routeId, recovered)
        setRecovery(recovered)
        setRecoveryResolved(false)
        setError('로그인이 필요합니다. 다시 로그인한 뒤 저장 전 초안을 복원해 주세요.')
        return
      }
      if (checkpoint.current.setId !== undefined) {
        recovered = preserveDraft(submitted, originalQuestionIds, checkpoint.current)
        setRecovery(recovered)
        setRecoveryResolved(false)
        setNeedsReload(true)
        try {
          install(await api.getQuestionSet(checkpoint.current.setId))
          setError(`${message} 서버 상태를 다시 불러왔습니다. 저장 전 초안은 별도로 보관했습니다. 내용을 비교하고 복구 방법을 선택해 주세요.`)
        } catch (reloadCause: unknown) {
          if (api.toQuestionSetApiError(reloadCause).status === 401) {
            rememberInterruptedDraft(user?.id, routeId, recovered)
            return
          }
          setError(`${message} 서버 상태를 확인하지 못했습니다. 재조회 후 다시 편집할 수 있습니다.`)
        }
      } else if (rejected) {
        checkpoint.current.creating = false
        setError(message)
      } else {
        recovered = preserveDraft(submitted, originalQuestionIds, checkpoint.current)
        setRecovery(recovered)
        setCreationUnknown(true)
        setError('세트 생성 결과를 확인할 수 없습니다. 중복 생성을 막기 위해 자동 재시도와 재저장을 중단했습니다. 목록에서 생성 여부를 확인해 주세요. 다른 탭이나 새 주소에서 다시 생성하면 중복될 수 있습니다.')
      }
    } finally {
      await unlock()
      working.current = false
      setSaving(false)
    }
    if (!mounted.current) return
    if (complete) onSaved()
    else if (recovered) {
      // 모든 요청과 재조회가 끝난 뒤 교체한다. pathname 키에 의한 재마운트에 초안을 전달한다.
      navigate(recoveryPath(recovered), { replace: true, state: { questionSetRecovery: recovered } })
    }
  }

  const reload = () => {
    if (working.current) return
    setLoading(true)
    setError('')
    setLoadAttempt((attempt) => attempt + 1)
  }
  const restore = () => {
    if (working.current || !recovery || !serverDraft || needsReload) return
    const plan = planRecovery(recovery, serverDraft)
    if (!plan.restored) return
    setDraft(plan.restored)
    setSelectedId(plan.restored.questions[0]?.id ?? '')
    setRecoveryResolved(true)
  }
  const useServer = () => {
    if (working.current || !serverDraft || needsReload) return
    setDraft(structuredClone(serverDraft))
    setSelectedId(serverDraft.questions[0]?.id ?? '')
    setRecoveryResolved(true)
    forgetInterruptedDraft(user?.id, routeId)
  }
  return { draft, setDraft, selectedId, setSelectedId, loading, saving, error, setError,
    needsReload, creationUnknown, save, reload, originalDraft, recovery, recoveryResolved, serverDraft, restore, useServer }
}
