import { useCallback, useEffect, useRef } from 'react'
import { toApiError } from '../../auth/api'
import { getStompStatus, onStompErrorMessage } from '../../../shared/stomp'
import { useClassroom } from '../../room/useClassroom'
import { abortQuiz, closeQuizResults, startQuiz } from '../api'

/** 수업 동기화 상태에 교수의 퀴즈 시작·중단·결과 닫기를 연결한다. */
export function useProfessorQuiz(roomId: number | null, onError: (message: string) => void) {
  const classroom = useClassroom(roomId, true)
  const { quiz } = classroom
  useEffect(() => onStompErrorMessage((error) => onError(error.message)), [onError])

  const runId = quiz.phase === 'waiting' ? null : quiz.runId

  /** 시작·중단·결과 닫기를 보낸다. 버튼을 연달아 눌러도 요청은 한 번에 하나만 나간다. */
  const requesting = useRef(false)
  const send = useCallback(
    async (request: () => Promise<unknown>) => {
      if (requesting.current) {
        return
      }
      requesting.current = true
      try {
        await request()
      } catch (error) {
        onError(toApiError(error).message)
      } finally {
        requesting.current = false
      }
    },
    [onError],
  )

  const ready = classroom.ready

  const start = useCallback(
    async (questionSetId: number) => {
      if (roomId === null) {
        return
      }
      // 끊긴 채 시작하면 QUESTION_OPENED를 놓쳐 서버만 진행된다. 세트 상세를 불러오는 사이에 끊길 수 있어
      // 렌더 시점의 ready가 아니라 지금 연결 상태를 다시 읽는다.
      if (!ready || getStompStatus() !== 'connected') {
        onError('실시간 연결이 끊겨 시작하지 못했습니다. 연결된 뒤 다시 시도해 주세요.')
        return
      }
      await send(() => startQuiz(roomId, questionSetId))
    },
    [roomId, ready, send, onError],
  )

  const stop = useCallback(async () => {
    if (roomId !== null && runId !== null) {
      await send(() => abortQuiz(roomId, runId))
    }
  }, [roomId, runId, send])

  const closeResults = useCallback(async () => {
    if (roomId !== null) {
      await send(() => closeQuizResults(roomId))
    }
  }, [roomId, send])

  return {
    ...classroom,
    ready,
    start,
    stop,
    closeResults,
  }
}
