import { useEffect, useState } from 'react'
import { toQuestionSetApiError } from '../questionset/api'

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'Error') return error.message
  const failure = toQuestionSetApiError(error)
  if (failure.code === 'FORBIDDEN') return '비공개이거나 접근할 수 없는 문제 세트입니다.'
  if (failure.code === 'QUESTION_SET_NOT_FOUND') return '문제 세트를 찾을 수 없습니다.'
  if (failure.code === 'UNAUTHORIZED') return '로그인이 필요합니다. 다시 로그인해 주세요.'
  return failure.message
}

/** 화면 이탈·ID 변경·재시도 이전에 시작한 응답은 반영하지 않는다. */
export function useReviewResource<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    load: typeof load; attempt: number; data?: T; error?: string
  }>()
  useEffect(() => {
    let active = true
    void load().then(
      data => { if (active) setState({ load, attempt, data }) },
      error => { if (active) setState({ load, attempt, error: errorMessage(error) }) },
    )
    return () => { active = false }
  }, [load, attempt])
  const current = state?.load === load && state.attempt === attempt ? state : undefined
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    retry: () => setAttempt(value => value + 1),
  }
}
