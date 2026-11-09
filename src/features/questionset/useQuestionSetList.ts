import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteQuestionSet, getMyQuestionSets, toQuestionSetApiError } from './api'
import type { QuestionSetSummaryResponse } from './questionset.types'

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
  const deleteInFlight = useRef(false)
  const syncRequired = useRef(false)
  const revision = useRef(0)
  const session = useRef({ active: false })

  const loadList = useCallback(async () => {
    const request = ++revision.current
    const active = session.current
    setLoading(true)
    setLoadError('')
    try {
      const data = await getMyQuestionSets()
      if (active.active && request === revision.current) {
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
    session.current = active
    void loadList()
    return () => { active.active = false }
  }, [loadList])

  const reload = async () => {
    if (deleteInFlight.current) return
    setDeleteError('')
    await loadList()
  }

  const confirmDelete = async () => {
    if (!deleting || deleteInFlight.current || syncRequired.current) return
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
        setSets((current) => current.filter((set) => set.id !== id))
        setDeleting(null)
      }
    } catch (error: unknown) {
      if (!active.active) return
      const failure = toQuestionSetApiError(error)
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

  return { sets, loading, loadError, deleting, setDeleting, deletePending, deleteError, setDeleteError, reload, confirmDelete }
}
