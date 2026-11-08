import { useCallback, useEffect, useReducer, useRef } from 'react'
import { toApiError } from '../../auth/api'
import {
  connectStomp,
  onStompErrorMessage,
  subscribe,
  useStompStatus,
} from '../../../shared/stomp'
import { abortQuiz, closeQuizResults, startQuiz } from '../api'
import {
  initialProfessorQuiz,
  professorQuizReducer,
  toProfessorQuizMessage,
} from '../professorQuizReducer'

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

    // 토큰·만료 처리 설정은 AuthProvider(#44)가 맡고, 여기서는 연결만 시작한다.
    // 연결은 탭에 하나만 만들어지고, 화면을 떠나도 끊지 않는다(shared/stomp 규칙).
    try {
      connectStomp()
    } catch {
      // 로그인 없이 보는 개발용 미리보기에서는 설정 전에 이 화면이 그려질 수 있다.
      onError('로그인한 뒤에 퀴즈를 진행할 수 있습니다.')
    }
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

  const ready = roomId !== null && stompStatus === 'connected'

  const start = useCallback(
    async (questionSetId: number) => {
      if (roomId === null) {
        return
      }
      // 끊긴 채 시작하면 QUESTION_OPENED를 놓쳐 서버만 진행된다. 세트 선택 창이 열린 뒤 끊긴 경우도 막는다.
      if (!ready) {
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
    quiz,
    ready,
    start,
    stop,
    closeResults,
  }
}
