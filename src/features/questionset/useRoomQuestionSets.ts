import { useEffect, useRef, useState } from 'react'
import { getMyQuestionSets, getQuestionSet, toQuestionSetApiError } from './api'
import type { QuestionSetSummaryResponse } from './questionset.types'
import type { RoomQuestionSet } from '../professor/dashboard-types'
import { RoomQuestionSetError, toRoomQuestionSet } from './roomQuestionSet'

function errorMessage(error: unknown): string {
  if (error instanceof RoomQuestionSetError) return error.message
  const failure = toQuestionSetApiError(error)
  if (failure.code === 'UNAUTHORIZED' || failure.status === 401) return '로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.'
  if (failure.code === 'FORBIDDEN' || failure.status === 403) return '문제 세트를 조회할 권한이 없습니다.'
  if (failure.code === 'QUESTION_SET_NOT_FOUND') return '문제 세트가 삭제되었거나 찾을 수 없습니다. 목록을 새로 불러와 주세요.'
  return failure.message
}

/** 선택 창을 열 때마다 새로 마운트한다. 닫힌 창의 상세 응답으로 퀴즈를 시작하지 않는다. */
export function useRoomQuestionSets(onSelect: (set: RoomQuestionSet) => void) {
  const [sets, setSets] = useState<QuestionSetSummaryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const session = useRef({ active: false })

  useEffect(() => {
    const request = ++generation.current
    const active = { active: true }
    session.current = active
    getMyQuestionSets().then((data) => {
      if (active.active && request === generation.current) setSets(data)
    }).catch((error: unknown) => {
      if (active.active && request === generation.current) setListError(errorMessage(error))
    }).finally(() => {
      if (active.active && request === generation.current) setLoading(false)
    })
    return () => { active.active = false }
  }, [attempt])

  const reload = () => {
    if (inFlight.current) return
    setSets([])
    setLoading(true)
    setListError('')
    setDetailError('')
    setSelectedId(null)
    setAttempt((value) => value + 1)
  }
  const select = async (id: number) => {
    if (loading || listError || inFlight.current || !sets.some((set) => set.id === id)) return
    inFlight.current = true
    const request = ++generation.current
    const active = session.current
    setSelectedId(id)
    setSelecting(true)
    setDetailError('')
    try {
      const detail = await getQuestionSet(id)
      if (active.active && request === generation.current) onSelect(toRoomQuestionSet(detail))
    } catch (error: unknown) {
      if (active.active && request === generation.current) setDetailError(errorMessage(error))
    } finally {
      inFlight.current = false
      if (active.active && request === generation.current) setSelecting(false)
    }
  }
  return { sets, loading, listError, detailError, selectedId, selecting, reload, select }
}
