import { useCallback, useEffect, useReducer, useRef } from 'react'
import { toApiError } from '../../auth/api'
import {
  connectStomp,
  getStompStatus,
  onStompConnected,
  onStompErrorMessage,
  subscribe,
  useStompStatus,
} from '../../../shared/stomp'
import { abortQuiz, closeQuizResults, getRoomState, startQuiz } from '../api'
import {
  initialProfessorQuiz,
  professorQuizReducer,
  toProfessorQuizMessage,
} from '../professorQuizReducer'
import { compareServerTime } from '../serverClock'
import type { ProfessorQuizMessage } from '../types'

/** state 조회가 일시적으로 실패했을 때 다시 시도하기 전 기다리는 시간. */
const SYNC_RETRY_DELAYS_MS = [1_000, 2_000]

/**
 * 교수 화면의 퀴즈 상태를 서버 메시지와 맞춘다.
 *
 * - 화면 상태는 메시지로만 바뀐다. REST 응답은 성공 확인에만 쓴다(06 4절)
 * - 시작 응답에는 문제 내용이 없어 QUESTION_OPENED를 놓치면 화면이 바뀌지 않는다.
 *   그래서 방에 들어오면 먼저 구독하고, 연결된 뒤에만 시작할 수 있게 한다(ready)
 * - 연결·재연결될 때마다 GET /state로 지금 화면을 다시 그린다(새로고침 복원, 06 1절)
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
    let disposed = false
    /** 마지막으로 보낸 state 조회 번호. 늦게 온 이전 조회 응답은 버린다. */
    let latestSync = 0
    /** state를 조회하는 동안 받은 메시지. null이면 조회 중이 아니어서 바로 반영한다. */
    let pending: { message: ProfessorQuizMessage; receivedAt: number }[] | null = null

    const handleMessage = (body: unknown) => {
      const message = toProfessorQuizMessage(body)
      if (!message) {
        return
      }
      const received = { message, receivedAt: Date.now() }
      if (pending) {
        pending.push(received)
      } else {
        dispatch({ kind: 'message', ...received })
      }
    }

    /**
     * 조회 중 온 메시지를 모았다가, 스냅샷을 먼저 그린 뒤 스냅샷보다 나중 것만 도착 순서대로 반영한다.
     * 스냅샷 이전 메시지(sentAt ≤ serverTime)는 이미 스냅샷에 담겨 있어 다시 반영하면 화면이 되돌아간다.
     * 같은 절차를 공통 모듈로 만드는 일은 #64가 맡는다.
     */
    let retryTimer: number | undefined
    const sync = (attempt = 0) => {
      window.clearTimeout(retryTimer)
      const syncId = ++latestSync
      pending = pending ?? []
      getRoomState(roomId)
        .then((snapshot) => {
          if (disposed || syncId !== latestSync) return
          const buffered = pending ?? []
          pending = null
          dispatch({ kind: 'snapshot', snapshot, receivedAt: Date.now() })
          buffered
            .filter(({ message }) => compareServerTime(message.sentAt, snapshot.serverTime) > 0)
            .forEach((received) => dispatch({ kind: 'message', ...received }))
        })
        .catch((error: unknown) => {
          if (disposed || syncId !== latestSync) return
          const failure = toApiError(error)
          // 서버에 닿지 못했거나 서버 오류면 1초, 2초 뒤 다시 조회한다. 그동안 받은 메시지는 계속 모은다.
          if ((failure.status === 0 || failure.status >= 500) && attempt < SYNC_RETRY_DELAYS_MS.length) {
            retryTimer = window.setTimeout(() => sync(attempt + 1), SYNC_RETRY_DELAYS_MS[attempt])
            return
          }
          // 끝내 실패해도 그동안 받은 메시지는 버리지 않고 반영한다.
          const buffered = pending ?? []
          pending = null
          buffered.forEach((received) => dispatch({ kind: 'message', ...received }))
          onError(failure.message)
        })
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
    // 구독이 (다시) 걸린 뒤 불린다. 이미 연결돼 있으면 바로 조회한다.
    const removeConnectedListener = onStompConnected(() => sync())
    if (getStompStatus() === 'connected') {
      sync()
    }

    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      removeConnectedListener()
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
      // 끊긴 채 시작하면 QUESTION_OPENED를 놓쳐 서버만 진행된다. 세트 상세를 불러오는 사이에 끊길 수 있어
      // 렌더 시점의 ready가 아니라 지금 연결 상태를 다시 읽는다.
      if (getStompStatus() !== 'connected') {
        onError('실시간 연결이 끊겨 시작하지 못했습니다. 연결된 뒤 다시 시도해 주세요.')
        return
      }
      await send(() => startQuiz(roomId, questionSetId))
    },
    [roomId, send, onError],
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
