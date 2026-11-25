import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteQuestionSet, getMyQuestionSets, toQuestionSetApiError, updateQuestionSet } from './api'
import type { QuestionSetSummaryResponse, Visibility } from './questionset.types'

type VisibilityFeedback = { status: 'pending' | 'success' | 'error' | 'unknown'; message: string }
const SUCCESS_FEEDBACK_MS = 3000

function errorMessage(error: unknown): string {
  const failure = toQuestionSetApiError(error)
  if (failure.code === 'QUESTION_SET_IN_USE') return '퀴즈에 사용된 문제 세트는 삭제할 수 없습니다.'
  if (failure.code === 'UNAUTHORIZED' || failure.status === 401) return '로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.'
  if (failure.code === 'FORBIDDEN' || failure.status === 403) return '문제 세트에 접근할 권한이 없습니다.'
  return failure.message
}

export function useQuestionSetList() {
  const [sets, setSets] = useState<QuestionSetSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [deleting, setDeleting] = useState<QuestionSetSummaryResponse | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [visibilityFeedback, setVisibilityFeedback] = useState<Record<number, VisibilityFeedback>>({})
  const visibilityInFlight = useRef(new Set<number>())
  const unconfirmedVisibility = useRef(new Map<number, Visibility>())
  const deleteInFlight = useRef(false)
  const syncRequired = useRef(false)
  const revision = useRef(0)
  const session = useRef({ active: false })
  const visibilityTimers = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; feedback: VisibilityFeedback }>())

  const loadList = useCallback(async () => {
    const request = ++revision.current
    const active = session.current
    setLoading(true)
    setLoadError('')
    try {
      const data = await getMyQuestionSets()
      if (active.active && request === revision.current) {
        const ids = new Set(data.map(({ id }) => id))
        setVisibilityFeedback((current) => Object.fromEntries(
          Object.entries(current).filter(([id]) => ids.has(Number(id))),
        ))
        setSets(data)
        syncRequired.current = false
        return true
      }
    } catch (error: unknown) {
      if (active.active && request === revision.current) {
        setLoadError(`${syncRequired.current ? '삭제 여부를 확인하지 못했습니다. ' : ''}${errorMessage(error)}`)
      }
    } finally {
      if (active.active && request === revision.current) setLoading(false)
    }
    return false
  }, [])

  useEffect(() => {
    const active = { active: true }
    const timers = visibilityTimers.current
    session.current = active
    void loadList()
    return () => {
      active.active = false
      timers.forEach(({ timer }) => clearTimeout(timer))
      timers.clear()
    }
  }, [loadList])

  useEffect(() => {
    const active = session.current
    const timers = visibilityTimers.current
    for (const [id, { timer, feedback }] of timers) {
      if (visibilityFeedback[id] === feedback) continue
      clearTimeout(timer)
      timers.delete(id)
    }
    for (const [key, feedback] of Object.entries(visibilityFeedback)) {
      const id = Number(key)
      if (feedback.status !== 'success' || timers.has(id)) continue
      const timer = setTimeout(() => {
        if (!active.active || timers.get(id)?.timer !== timer) return
        timers.delete(id)
        setVisibilityFeedback((current) => {
          if (current[id] !== feedback) return current
          const next = { ...current }
          delete next[id]
          return next
        })
      }, SUCCESS_FEEDBACK_MS)
      timers.set(id, { timer, feedback })
    }
  }, [visibilityFeedback])

  const reload = async () => {
    if (deleteInFlight.current || visibilityInFlight.current.size) return
    setDeleteError('')
    await loadList()
  }

  const toggleVisibility = async (set: QuestionSetSummaryResponse) => {
    const { id } = set
    if (deleting || deleteInFlight.current || syncRequired.current || visibilityInFlight.current.has(id)) return
    const active = session.current
    const unconfirmed = unconfirmedVisibility.current.get(id)
    const visibility = unconfirmed ?? (set.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')
    // 앞서 시작된 목록 조회가 이번 변경 결과를 덮어쓰지 않게 한다.
    revision.current++
    setLoading(false)
    visibilityInFlight.current.add(id)
    const report = (status: VisibilityFeedback['status'], message: string) => {
      if (active.active) setVisibilityFeedback((current) => ({ ...current, [id]: { status, message } }))
    }
    try {
      let updated: QuestionSetSummaryResponse | undefined
      if (unconfirmed === undefined) {
        report('pending', '변경 중…')
        try {
          updated = await updateQuestionSet(id, { visibility })
        } catch (error: unknown) {
          if (!active.active) return
          const { status } = toQuestionSetApiError(error)
          if (status !== 0 && status !== 408 && status < 500) {
            report('error', `공개 상태를 변경하지 못했습니다. ${errorMessage(error)}`)
            return
          }
          unconfirmedVisibility.current.set(id, visibility)
        }
      }
      if (!updated) {
        report('pending', '상태 확인 중…')
        const rows = await getMyQuestionSets().catch(() => undefined)
        updated = rows?.find((item) => item.id === id)
      }
      if (!active.active) return
      if (!updated) {
        report('unknown', '상태 확인 불가 · 토글로 재확인')
        return
      }
      unconfirmedVisibility.current.delete(id)
      const confirmed = updated
      setSets((current) => current.map((item) => item.id === id ? confirmed : item))
      const label = confirmed.visibility === 'PUBLIC' ? '공개' : '비공개'
      if (confirmed.visibility === visibility) report('success', `${label}로 변경했습니다.`)
      else report('error', `서버에서 ${label} 상태를 확인했습니다. 다시 시도해 주세요.`)
    } finally {
      visibilityInFlight.current.delete(id)
    }
  }

  const confirmDelete = async () => {
    if (!deleting || deleting.used || deleteInFlight.current || visibilityInFlight.current.size || syncRequired.current) return
    const active = session.current
    const id = deleting.id
    deleteInFlight.current = true
    // 삭제 이전에 시작한 GET이 삭제 성공 후 항목을 되살리지 못하게 한다.
    revision.current++
    setLoading(false)
    setLoadError('')
    setDeletePending(true)
    setDeleteError('')
    try {
      await deleteQuestionSet(id)
      if (active.active) {
        setVisibilityFeedback((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
        setSets((current) => current.filter((set) => set.id !== id))
        setDeleting(null)
      }
    } catch (error: unknown) {
      if (!active.active) return
      const failure = toQuestionSetApiError(error)
      if (failure.code === 'QUESTION_SET_IN_USE') {
        setSets((current) => current.map((set) => set.id === id ? { ...set, used: true } : set))
        setDeleting((current) => current?.id === id ? { ...current, used: true } : current)
      }
      if (failure.status === 0 || (failure.status === 404 && failure.code === 'QUESTION_SET_NOT_FOUND')) {
        syncRequired.current = true
        setDeleting(null)
        const synced = await loadList()
        if (active.active && synced) setDeleteError('삭제 결과를 확인하기 위해 서버 목록을 다시 불러왔습니다. 표시된 목록을 확인해 주세요.')
      } else {
        setDeleteError(errorMessage(error))
      }
    } finally {
      deleteInFlight.current = false
      if (active.active) setDeletePending(false)
    }
  }

  const visibilityPending = Object.values(visibilityFeedback).some(({ status }) => status === 'pending')
  return { sets, loading, loadError, deleting, setDeleting, deletePending, deleteError, setDeleteError, reload,
    confirmDelete, toggleVisibility, visibilityFeedback, visibilityPending }
}
