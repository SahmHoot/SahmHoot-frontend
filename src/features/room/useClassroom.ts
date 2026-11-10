import { useEffect, useReducer, useState } from 'react'
import { toApiError } from '../auth/api'
import { initialProfessorQuiz, professorQuizReducer, toProfessorQuizMessage } from '../quiz/professorQuizReducer'
import { useRoomSync, useStompStatus } from '../../shared/stomp'
import type { RoomStateResponse } from '../../shared/types/roomState'

/** 교수·참가자 화면은 같은 구독과 서버 스냅샷으로 수업 상태를 복원한다. */
export function useClassroom(roomId: number | null, owner: boolean) {
  const [snapshot, setSnapshot] = useState<RoomStateResponse | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState('')
  const [quiz, dispatch] = useReducer(professorQuizReducer, initialProfessorQuiz)
  const status = useStompStatus()

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
      dispatch({ kind: 'snapshot', snapshot: state, receivedAt: Date.now() })
    },
    onMessage: (channel, message) => {
      if (channel === 'quiz' && message.type === 'ROOM_ENDED') { setEnded(true); return }
      if (channel === 'presence' && message.type === 'ONLINE_COUNT' &&
        typeof message.onlineCount === 'number' && Number.isSafeInteger(message.onlineCount) && message.onlineCount >= 0) {
        setOnlineCount(message.onlineCount)
      }
      const quizMessage = channel === 'quiz' || channel === 'stats' ? toProfessorQuizMessage(message) : null
      if (quizMessage) dispatch({ kind: 'message', message: quizMessage, receivedAt: Date.now() })
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
