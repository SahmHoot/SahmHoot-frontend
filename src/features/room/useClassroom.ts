import { useEffect, useReducer, useState } from 'react'
import { toApiError } from '../auth/api'
import { initialProfessorQuiz, professorQuizReducer, toProfessorQuizMessage } from '../quiz/professorQuizReducer'
import type { ProfessorQuizAction } from '../quiz/professorQuizReducer'
import { useRoomSync, useStompStatus } from '../../shared/stomp'
import type { RoomStateResponse } from '../../shared/types/roomState'

/**
 * 교수·참가자 화면은 같은 구독과 서버 스냅샷으로 수업 상태를 복원한다.
 * onQuizAction은 퀴즈 상태에 반영한 snapshot·message 동작을 그대로 받는다(학생 화면의 내 답·정답 상태용).
 */
export function useClassroom(roomId: number | null, owner: boolean, onQuizAction?: (action: ProfessorQuizAction) => void) {
  const [snapshot, setSnapshot] = useState<RoomStateResponse | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState('')
  const [quiz, dispatch] = useReducer(professorQuizReducer, initialProfessorQuiz)
  const status = useStompStatus()
  const apply = (action: ProfessorQuizAction) => { dispatch(action); onQuizAction?.(action) }

  useEffect(() => {
    setSnapshot(null)
    setOnlineCount(0)
    setEnded(false)
    setError('')
    dispatch({ kind: 'reset' })
  }, [roomId, owner])

  useRoomSync(roomId, owner, {
    onSnapshot: (state) => {
      if (state.room.status === 'CLOSED') { setEnded(true); return }
      if (state.me.isOwner !== owner) { setError('이 화면에서 수업을 열 수 없습니다. 홈에서 다시 입장해 주세요.'); return }
      setSnapshot(state)
      setOnlineCount(state.onlineCount)
      setError('')
      apply({ kind: 'snapshot', snapshot: state, receivedAt: Date.now() })
    },
    onMessage: (channel, message) => {
      if (channel === 'quiz' && message.type === 'ROOM_ENDED') { setEnded(true); return }
      if (channel === 'presence' && message.type === 'ONLINE_COUNT' &&
        typeof message.onlineCount === 'number' && Number.isSafeInteger(message.onlineCount) && message.onlineCount >= 0) {
        setOnlineCount(message.onlineCount)
      }
      const quizMessage = channel === 'quiz' || channel === 'stats' ? toProfessorQuizMessage(message) : null
      if (quizMessage) apply({ kind: 'message', message: quizMessage, receivedAt: Date.now() })
    },
    onSyncError: (failure) => {
      const apiError = toApiError(failure)
      if (apiError.code === 'ROOM_CLOSED' || apiError.code === 'ROOM_NOT_FOUND') setEnded(true)
      else setError(apiError.message)
    },
  })

  return { snapshot, onlineCount, ended, error, quiz,
    ready: snapshot?.room.id === roomId && status === 'connected' && !ended && !error }
}
