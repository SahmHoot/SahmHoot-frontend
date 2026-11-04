import { useCallback, useEffect, useReducer } from 'react'
import { getAccessToken } from '../../auth/session'
import { toApiError } from '../../auth/api'
import {
  configureStomp,
  connectStomp,
  onStompErrorMessage,
  subscribe,
  useStompStatus,
} from '../../../shared/stomp'
import { abortQuiz, closeQuizResults, fetchMyQuestionSets, startQuiz } from '../api'
import {
  initialProfessorQuiz,
  professorQuizReducer,
  toProfessorQuizMessage,
} from '../professorQuizReducer'
import type { QuestionSetSummary } from '../types'

/**
 * 교수 화면의 퀴즈 상태를 서버 메시지와 맞춘다.
 *
 * - 화면 상태는 메시지로만 바뀐다. REST 응답은 성공 확인에만 쓴다(06 4절)
 * - 시작 응답에는 문제 내용이 없어 QUESTION_OPENED를 놓치면 화면이 바뀌지 않는다.
 *   그래서 방에 들어오면 먼저 구독하고, 연결된 뒤에만 시작할 수 있게 한다(ready)
 * - 재연결 뒤 놓친 메시지 복구는 GET /state가 필요해 #26 이후에 붙인다
 *
 * @param roomId 서버에 있는 수업 ID. 없으면 구독하지 않는다
 * @param onError 사용자에게 보여 줄 오류 문구를 받는다
 */
export function useProfessorQuiz(roomId: number | null, onError: (message: string) => void) {
  const [quiz, dispatch] = useReducer(professorQuizReducer, initialProfessorQuiz)
  const stompStatus = useStompStatus()

  useEffect(() => {
    if (roomId === null) {
      return
    }
    const handleMessage = (body: unknown) => {
      const message = toProfessorQuizMessage(body)
      if (message) {
        dispatch({ kind: 'message', message, receivedAt: Date.now() })
      }
    }

    // 연결은 탭에 하나만 만들어지고, 화면을 떠나도 끊지 않는다(shared/stomp 규칙).
    configureStomp({ getToken: getAccessToken })
    connectStomp()
    const unsubscribeQuiz = subscribe(`/topic/rooms/${roomId}/quiz`, handleMessage)
    const unsubscribeStats = subscribe(`/user/queue/rooms/${roomId}/stats`, handleMessage)
    const removeErrorListener = onStompErrorMessage((error) => onError(error.message))

    return () => {
      unsubscribeQuiz()
      unsubscribeStats()
      removeErrorListener()
      dispatch({ kind: 'reset' })
    }
  }, [roomId, onError])

  const runId = quiz.phase === 'waiting' ? null : quiz.runId

  /** 시작 창에 보여 줄 세트. 실패하면 오류를 알리고 빈 목록을 돌려준다. */
  const loadQuestionSets = useCallback(async (): Promise<QuestionSetSummary[]> => {
    try {
      return await fetchMyQuestionSets()
    } catch (error) {
      onError(toApiError(error).message)
      return []
    }
  }, [onError])

  const start = useCallback(
    async (questionSetId: number) => {
      if (roomId === null) {
        return
      }
      try {
        await startQuiz(roomId, questionSetId)
      } catch (error) {
        onError(toApiError(error).message)
      }
    },
    [roomId, onError],
  )

  const stop = useCallback(async () => {
    if (roomId === null || runId === null) {
      return
    }
    try {
      await abortQuiz(roomId, runId)
    } catch (error) {
      onError(toApiError(error).message)
    }
  }, [roomId, runId, onError])

  const closeResults = useCallback(async () => {
    if (roomId === null) {
      return
    }
    try {
      await closeQuizResults(roomId)
    } catch (error) {
      onError(toApiError(error).message)
    }
  }, [roomId, onError])

  return {
    quiz,
    ready: roomId !== null && stompStatus === 'connected',
    loadQuestionSets,
    start,
    stop,
    closeResults,
  }
}
