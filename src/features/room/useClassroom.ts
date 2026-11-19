import { useEffect, useReducer, useState } from 'react'
import { toApiError } from '../auth/api'
import { initialProfessorQuiz, professorQuizReducer, toProfessorQuizMessage } from '../quiz/professorQuizReducer'
import type { ProfessorQuizAction } from '../quiz/professorQuizReducer'
import { onStompErrorMessage, publish, useRoomSync, useStompStatus } from '../../shared/stomp'
import type { RoomChatMessage, RoomStateResponse } from '../../shared/types/roomState'
import { isReaction, isReactionStats, REACTION_DURATION_MS } from './reactions'
import type { FloatingReaction, Reaction, ReactionStats } from './reactions'

const realtimeErrorNotices = new Map([
  ['RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'],
  ['VALIDATION_FAILED', '보낸 내용을 확인한 뒤 다시 시도해 주세요.'],
  ['FORBIDDEN', '이 작업을 할 권한이 없습니다.'],
])

/**
 * 교수·참가자 화면은 같은 구독과 서버 스냅샷으로 수업 상태를 복원한다.
 * onQuizAction은 퀴즈 상태에 반영한 snapshot·message 동작을 그대로 받는다(학생 화면의 내 답·정답 상태용).
 */
export function useClassroom(roomId: number | null, owner: boolean, onQuizAction?: (action: ProfessorQuizAction) => void) {
  const [snapshot, setSnapshot] = useState<RoomStateResponse | null>(null)
  const [onlineCount, setOnlineCount] = useState(0)
  /** 고정 공지. state로 시작하고 NOTICE_PINNED·NOTICE_UNPINNED·MESSAGE_DELETED로 바꾼다(06 4절). */
  const [pinned, setPinned] = useState<RoomChatMessage[]>([])
  const [ended, setEnded] = useState(false)
  const [error, setError] = useState('')
  const [reactions, setReactions] = useState<FloatingReaction[]>([])
  const [reactionStats, setReactionStats] = useState<ReactionStats | null>(null)
  const [realtimeNotice, setRealtimeNotice] = useState<{ text: string } | null>(null)
  const [quiz, dispatch] = useReducer(professorQuizReducer, initialProfessorQuiz)
  const status = useStompStatus()
  const active = snapshot?.room.id === roomId && !ended && !error
  const ready = active && status === 'connected'
  const apply = (action: ProfessorQuizAction) => { dispatch(action); onQuizAction?.(action) }

  useEffect(() => {
    setSnapshot(null)
    setOnlineCount(0)
    setPinned([])
    setEnded(false)
    setError('')
    setReactionStats(null)
    setReactions([])
    setRealtimeNotice(null)
    dispatch({ kind: 'reset' })
  }, [roomId, owner])

  useEffect(() => {
    if (status !== 'connected' || ended || error) {
      setReactions([])
      setReactionStats(null)
    }
  }, [status, ended, error])

  useEffect(() => {
    if (!ready || reactions.length === 0) return
    const timeout = setTimeout(() => {
      const now = Date.now()
      setReactions((current) => current.filter(({ expiresAt }) => expiresAt > now))
    }, Math.max(0, reactions[0].expiresAt - Date.now()))
    return () => clearTimeout(timeout)
  }, [ready, reactions])

  useEffect(() => {
    if (!active || owner) return
    return onStompErrorMessage(({ code }) => {
      if (code === 'ROOM_CLOSED') {
        setEnded(true)
        return
      }
      // 오류에는 요청 목적지가 없어 현재 방의 공통 안내로 표시한다.
      const text = realtimeErrorNotices.get(code)
      if (text) setRealtimeNotice({ text })
    })
  }, [active, owner, roomId])

  useEffect(() => {
    if (!active || !realtimeNotice) return
    const timeout = setTimeout(() => setRealtimeNotice(null), 4_000)
    return () => clearTimeout(timeout)
  }, [active, realtimeNotice])

  useRoomSync(ended ? null : roomId, owner, {
    onSnapshot: (state) => {
      if (state.room.status === 'CLOSED') { setEnded(true); return }
      if (state.me.isOwner !== owner) { setError('이 화면에서 수업을 열 수 없습니다. 홈에서 다시 입장해 주세요.'); return }
      setSnapshot(state)
      setOnlineCount(state.onlineCount)
      setReactionStats(owner && isReactionStats(state.reactionStats) ? state.reactionStats : null)
      setPinned(state.pinnedMessages)
      setError('')
      apply({ kind: 'snapshot', snapshot: state, receivedAt: Date.now() })
    },
    onMessage: (channel, message) => {
      if (channel === 'quiz' && message.type === 'ROOM_ENDED') { setEnded(true); return }
      if (channel === 'reaction' && message.type === 'REACTION' && isReaction(message.emoji)) {
        const { emoji, sentAt } = message
        const expiresAt = Date.now() + REACTION_DURATION_MS
        setReactions((current) => {
          const previousLane = current[current.length - 1]?.lane ?? -1
          const lane = (previousLane + 1) % 4
          return [...current, { id: `${sentAt}/${emoji}`, emoji, expiresAt, lane }]
        })
        return
      }
      if (owner && channel === 'stats' && message.type === 'REACTION_STATS' && isReactionStats(message.reactionStats)) {
        setReactionStats(message.reactionStats)
        return
      }
      if (channel === 'presence' && message.type === 'ONLINE_COUNT' &&
        typeof message.onlineCount === 'number' && Number.isSafeInteger(message.onlineCount) && message.onlineCount >= 0) {
        setOnlineCount(message.onlineCount)
      }
      if (channel === 'chat') setPinned((current) => nextPinned(current, message))
      const quizMessage = channel === 'quiz' || channel === 'stats' ? toProfessorQuizMessage(message) : null
      if (quizMessage) apply({ kind: 'message', message: quizMessage, receivedAt: Date.now() })
    },
    onSyncError: (failure) => {
      const apiError = toApiError(failure)
      if (apiError.code === 'ROOM_CLOSED' || apiError.code === 'ROOM_NOT_FOUND') setEnded(true)
      else setError(apiError.message)
    },
  })

  function sendReaction(emoji: Reaction) {
    if (roomId === null || owner || !active) return
    if (!ready || !publish(`/app/rooms/${roomId}/reaction`, { emoji })) {
      setRealtimeNotice({ text: '연결이 끊겨 반응을 보내지 못했습니다. 다시 연결되면 눌러 주세요.' })
    }
  }

  return { snapshot, onlineCount, pinned, ended, error, quiz, ready, sendReaction,
    reactions: ready ? reactions : [], reactionStats: ready ? reactionStats : null,
    realtimeNotice: active ? realtimeNotice?.text : undefined }
}

function nextPinned(current: RoomChatMessage[], message: { type: string; [field: string]: unknown }): RoomChatMessage[] {
  if (message.type === 'NOTICE_PINNED') {
    const pinned = message.message as RoomChatMessage | undefined
    if (typeof pinned?.id !== 'number' || current.some((item) => item.id === pinned.id)) return current
    return [...current, pinned]
  }
  if (message.type === 'NOTICE_UNPINNED' || message.type === 'MESSAGE_DELETED') {
    return current.filter((item) => item.id !== message.messageId)
  }
  return current
}
