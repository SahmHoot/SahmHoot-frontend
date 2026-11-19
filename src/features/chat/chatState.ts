import type { RoomChatMessage, RoomStateResponse } from '../../shared/types/roomState'
import type { RoomChannel, RoomRealtimeMessage } from '../../shared/stomp'

export const initialChat = { messages: [] as RoomChatMessage[],
  blocked: false, meId: null as number | null, received: 0, latestMessageId: 0 }
export type ChatState = typeof initialChat
export type ChatAction = { type: 'reset' } | { type: 'snapshot'; state: RoomStateResponse }
  | { type: 'message'; channel: RoomChannel; message: RoomRealtimeMessage }

export function isChatMessage(value: RoomRealtimeMessage): value is RoomRealtimeMessage & RoomChatMessage {
  return value.type === 'MESSAGE' && typeof value.id === 'number' && Number.isSafeInteger(value.id) && value.id > 0 &&
    typeof value.senderParticipantId === 'number' && typeof value.nickname === 'string' && typeof value.isOwner === 'boolean' &&
    typeof value.content === 'string' && typeof value.createdAt === 'string' &&
    (value.parentId === null || typeof value.parentId === 'number') && (value.parentPreview === null || typeof value.parentPreview === 'string')
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'reset') return initialChat
  if (action.type === 'snapshot') {
    const messages = [...action.state.recentMessages].reverse()
    return { ...state, messages,
      blocked: action.state.me.chatBlocked, meId: action.state.me.participantId,
      received: state.received + (state.meId === null ? 0 : messages.filter(({ id }) => id > state.latestMessageId).length),
      latestMessageId: Math.max(state.latestMessageId, ...messages.map(({ id }) => id)) }
  }
  const { channel, message } = action
  if (channel === 'me' && message.type === 'MY_STATUS' && typeof message.chatBlocked === 'boolean') return { ...state, blocked: message.chatBlocked }
  if (channel !== 'chat') return state
  if (isChatMessage(message)) {
    if (state.messages.some(({ id }) => id === message.id)) return state
    return { ...state, messages: [...state.messages, message].sort((a, b) => a.id - b.id).slice(-50),
      received: state.received + 1, latestMessageId: Math.max(state.latestMessageId, message.id) }
  }
  if (message.type === 'MESSAGE_DELETED' && typeof message.messageId === 'number') return { ...state,
    messages: state.messages.filter(({ id }) => id !== message.messageId).map((item) => item.parentId === message.messageId ? { ...item, parentPreview: null } : item) }
  return state
}

export function chatContentError(content: string): string {
  if (!content.trim()) return '메시지를 입력해 주세요.'
  if ([...content].length > 300 || /[\uD800-\uDFFF]/u.test(content)) return '메시지는 올바른 문자로 1~300자까지 입력해 주세요.'
  return ''
}
