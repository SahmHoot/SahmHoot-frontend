import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { onStompStatus, publish } from '../../shared/stomp'
import type { RoomChannel, RoomRealtimeMessage, StompErrorMessage } from '../../shared/stomp'
import type { RoomStateResponse } from '../../shared/types/roomState'
import { chatContentError, chatReducer, initialChat, isChatMessage } from './chatState'

export function useRoomChat(roomId: number | null, ready: boolean) {
  const [state, dispatch] = useReducer(chatReducer, initialChat)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const pending = useRef<{ content: string; parentId: number | null; resolve: (sent: boolean) => void; timer: ReturnType<typeof setTimeout> } | null>(null)
  const finish = useCallback((sent: boolean, message = '') => {
    const request = pending.current
    if (!request) return
    pending.current = null
    clearTimeout(request.timer)
    setSending(false)
    setError(message)
    request.resolve(sent)
  }, [])
  useEffect(() => {
    dispatch({ type: 'reset' })
    setError('')
    setSending(false)
    return () => {
      const request = pending.current
      if (request) { clearTimeout(request.timer); request.resolve(false); pending.current = null }
    }
  }, [roomId])
  useEffect(() => onStompStatus((status) => {
    if (status !== 'connected') finish(false, '연결이 끊겼습니다. 대화 내용을 확인한 뒤 다시 보내 주세요.')
  }), [finish])

  const handleError = useCallback((failure: StompErrorMessage): boolean => {
    const blocked = failure.code === 'CHAT_BLOCKED'
    if (blocked) dispatch({ type: 'message', channel: 'me', message: { type: 'MY_STATUS', sentAt: failure.sentAt, chatBlocked: true } })
    // shortcut: ERROR에는 요청 ID가 없다, 상관 ID가 지원되면 해당 채팅 요청에만 오류를 연결한다.
    if (failure.code === 'QUESTION_CLOSED' || !pending.current) return blocked
    finish(false, failure.code === 'RATE_LIMITED'
      ? '메시지를 너무 자주 보냈습니다. 잠시 후 다시 시도해 주세요.' : failure.message)
    return true
  }, [finish])

  function receive(channel: RoomChannel, message: RoomRealtimeMessage) {
    dispatch({ type: 'message', channel, message })
    const request = pending.current
    if (channel === 'me' && message.type === 'MY_STATUS' && message.chatBlocked === true) finish(false, '교수님이 채팅을 제한했습니다.')
    if (channel === 'chat' && request && isChatMessage(message) && message.senderParticipantId === state.meId &&
      message.content === request.content && message.parentId === request.parentId) finish(true)
  }
  async function send(content: string, parentId: number | null = null): Promise<boolean> {
    if (pending.current) return false
    const invalid = chatContentError(content)
    const problem = invalid || (state.blocked ? '교수님이 채팅을 제한했습니다.' : !ready || roomId === null ? '수업에 연결된 뒤 다시 보내 주세요.' : '')
    if (problem) { setError(problem); return false }
    setError('')
    setSending(true)
    return new Promise((resolve) => {
      pending.current = { content, parentId, resolve,
        timer: setTimeout(() => finish(false, '전송 결과를 확인하지 못했습니다. 대화 내용을 확인한 뒤 다시 보내 주세요.'), 10000) }
      try {
        if (!publish(`/app/rooms/${roomId}/chat`, { content, parentId })) finish(false, '연결이 끊겨 메시지를 보내지 못했습니다.')
      } catch { finish(false, '메시지를 보내지 못했습니다. 연결 상태를 확인해 주세요.') }
    })
  }
  return { ...state, roomId, ready, error, sending, send, receive,
    handleError,
    restore: (snapshot: RoomStateResponse) => dispatch({ type: 'snapshot', state: snapshot }) }
}
export type RoomChat = ReturnType<typeof useRoomChat>
