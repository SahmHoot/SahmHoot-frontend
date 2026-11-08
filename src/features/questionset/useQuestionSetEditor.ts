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
  const [creationCandidates, setCreationCandidates] = useState<Awaited<ReturnType<typeof api.getMyQuestionSets>>>([])
  const existing = !isNew || initialRecovery?.setId !== undefined
  const [draft, setDraft] = useState<EditorDraft>(() => initialRecovery && !existing ? structuredClone(initialRecovery.draft) : ({ name: '', description: '', isPublic: false, questions: [newQuestion()] }))
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
    setRecovery((current) => {
      if (!current?.confirmedQuestionFailure) return current
      const knownIds = new Set([...current.originalQuestionIds, ...Object.values(current.createdIds)])
      return detail.questions.some((question) => !knownIds.has(question.id)) ? current
        : { ...current, uncertainQuestionId: undefined }
    })
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
    let creationBaseline: number[] | undefined
    setSaving(true)
    setError('')
    try {
      if (checkpoint.current.setId === undefined) {
        creationBaseline = (await api.getMyQuestionSets()).map((item) => item.id)
      }
      const savedId = await saveEditor(submitted, checkpoint.current, api)
      // 최종 상세 조회까지 완료된 뒤 이동한다.
      install(await api.getQuestionSet(savedId))
      forgetInterruptedDraft(user?.id, routeId)
      complete = true
    } catch (cause: unknown) {
      const failure = api.toQuestionSetApiError(cause)
      const fields = failure.fieldErrors?.map((field) => field.message).join(' ') ?? ''
      const message = `${failure.message} ${fields}`.trim()
      const rejected = failure.status >= 400 && failure.status < 500
      const confirmedFailure = rejected || failure.status === 500
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
        recovered.confirmedQuestionFailure = confirmedFailure
        setRecovery(recovered)
        setRecoveryResolved(false)
        setNeedsReload(true)
        try {
          const detail = await api.getQuestionSet(checkpoint.current.setId)
          // 500도 커밋 후 오류일 수 있다. 알 수 없는 새 ID가 없을 때만 재생성을 허용한다.
          const knownIds = new Set([...originalQuestionIds, ...Object.values(checkpoint.current.createdIds ?? {})])
          if (confirmedFailure && !detail.questions.some((question) => !knownIds.has(question.id))) {
            recovered.uncertainQuestionId = undefined
          }
          install(detail)
          setError(`${message} 서버 상태를 다시 불러왔습니다. 저장 전 초안은 별도로 보관했습니다. 내용을 비교하고 복구 방법을 선택해 주세요.`)
        } catch (reloadCause: unknown) {
          if (api.toQuestionSetApiError(reloadCause).status === 401) {
            rememberInterruptedDraft(user?.id, routeId, recovered)
            return
          }
          setError(`${message} 서버 상태를 확인하지 못했습니다. 재조회 후 다시 편집할 수 있습니다.`)
        }
      } else if (rejected || !checkpoint.current.creating) {
        checkpoint.current.creating = false
        recovered = preserveDraft(submitted, originalQuestionIds, checkpoint.current)
        setRecovery(recovered)
        setRecoveryResolved(true)
        setError(message)
      } else {
        recovered = preserveDraft(submitted, originalQuestionIds, checkpoint.current)
        recovered.creationBaseline = creationBaseline
        recovered.creationFailed = failure.status === 500
        setRecovery(recovered)
        setCreationUnknown(true)
        if (failure.status === 500) {
          try {
            const candidates = (await api.getMyQuestionSets()).filter((item) => !creationBaseline?.includes(item.id))
            setCreationCandidates(candidates)
            if (creationBaseline && candidates.length === 0) {
              checkpoint.current.creating = false
              recovered.creationUnknown = false
              setCreationUnknown(false)
              setRecoveryResolved(true)
            }
          } catch (reloadCause: unknown) {
            if (api.toQuestionSetApiError(reloadCause).status === 401) {
              rememberInterruptedDraft(user?.id, routeId, recovered)
              return
            }
            // 재조회 실패 시 확인 버튼으로 다시 조회한다.
          }
        }
        setError(`${message} 초안을 보관했습니다. 생성 후보가 있으면 내용을 확인하여 선택해 주세요. 새 세트가 없다고 확인된 500 실패는 다시 저장할 수 있습니다.`)
      }
    } finally {
      await unlock()
      working.current = false
      setSaving(false)
    }
    if (recovered) {
      rememberInterruptedDraft(user?.id, routeId, recovered)
      rememberInterruptedDraft(user?.id, String(recovered.setId ?? 'new'), recovered)
    }
    if (!mounted.current) return
    if (complete) onSaved()
    else if (recovered) {
      // 모든 요청과 재조회가 끝난 뒤 교체한다. pathname 키에 의한 재마운트에 초안을 전달한다.
      navigate(recoveryPath(recovered), { replace: true, state: { questionSetRecovery: recovered } })
    }
  }

  const checkCreation = async () => {
    if (working.current || !recovery) return
    working.current = true
    setSaving(true)
    try {
      const candidates = (await api.getMyQuestionSets()).filter((item) => !recovery.creationBaseline?.includes(item.id))
      setCreationCandidates(candidates)
      if (recovery.creationFailed && recovery.creationBaseline && candidates.length === 0) {
        checkpoint.current.creating = false
        const next = { ...recovery, creationUnknown: false }
        setRecovery(next)
        setCreationUnknown(false)
        setDraft(structuredClone(recovery.draft))
        setRecoveryResolved(true)
        rememberInterruptedDraft(user?.id, routeId, next)
        setError('서버에 새 세트가 없음을 확인했습니다. 초안을 확인한 뒤 다시 저장해 주세요.')
      }
    } catch (cause: unknown) { setError(api.toQuestionSetApiError(cause).message) }
    finally { working.current = false; setSaving(false) }
  }
  const selectCreatedSet = (id: number) => {
    if (working.current || !recovery || !creationCandidates.some((item) => item.id === id)) return
    const next = { ...recovery, setId: id, creationUnknown: false }
    rememberInterruptedDraft(user?.id, routeId, next)
    rememberInterruptedDraft(user?.id, String(id), next)
    navigate(recoveryPath(next), { replace: true, state: { questionSetRecovery: next } })
  }
  const reload = () => {
    if (working.current) return
    setLoading(true)
    setError('')
    setLoadAttempt((attempt) => attempt + 1)
  }
  const restore = () => {
    if (working.current || !recovery || !serverDraft || needsReload || creationUnknown) return
    const plan = planRecovery(recovery, serverDraft)
    if (!plan.restored) return
    setDraft(plan.restored)
    setSelectedId(plan.restored.questions[0]?.id ?? '')
    setRecoveryResolved(true)
  }
  const useServer = () => {
    if (working.current || !serverDraft || needsReload || creationUnknown) return
    setDraft(structuredClone(serverDraft))
    setSelectedId(serverDraft.questions[0]?.id ?? '')
    setRecoveryResolved(true)
    forgetInterruptedDraft(user?.id, routeId)
  }
  return { draft, setDraft, selectedId, setSelectedId, loading, saving, error, setError,
    needsReload, creationUnknown, save, reload, originalDraft, recovery, recoveryResolved, serverDraft, restore, useServer, creationCandidates, checkCreation, selectCreatedSet }
}
