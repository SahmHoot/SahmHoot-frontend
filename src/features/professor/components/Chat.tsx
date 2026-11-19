import './Chat.css'
import { useEffect, useRef, useState } from 'react'
import { ChatComposer } from '../../chat/ChatComposer'
import { ChatModeration } from '../../chat/ChatModeration'
import type { RoomChat } from '../../chat/useRoomChat'
import type { RoomChatMessage } from '../../../shared/types/roomState'
import { ChatReactions } from '../../room/ChatReactions'
import type { FloatingReaction } from '../../room/reactions'

export function Chat({ compact, chat, reactions, notices, onUnpin }: {
  compact: boolean; chat: RoomChat; reactions: FloatingReaction[]
  notices: { id: number; content: string }[]; onUnpin: (messageId: number) => void
}) {
  const [reply, setReply] = useState<RoomChatMessage | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const last = chat.messages[chat.messages.length - 1]?.id
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [last])
  const parent = reply && chat.messages.some(({ id }) => id === reply.id) ? reply : null
  return <section aria-label="수업 채팅" className={`professor-chat ${compact ? 'professor-chat--compact' : 'professor-chat--expanded'}`}>
    <div className="professor-chat__header"><h2 className="professor-chat__title">실시간 채팅</h2></div>
    {notices.length > 0 && <div className="professor-chat__notices">{notices.map((notice) => <div key={notice.id} className="professor-chat__notice">
      <span className="professor-chat__notice-body professor-chat__notice-text">{notice.content}</span>
      <button type="button" onClick={() => onUnpin(notice.id)} aria-label={`고정 해제: ${notice.content}`} className="professor-chat__unpin-button">해제</button>
    </div>)}</div>}
    <div className="chat-messages-area">
      <div ref={list} className="professor-chat__messages" role="log" aria-label="채팅 메시지" aria-live="polite" aria-relevant="additions">
        {chat.messages.map((message) => <article key={message.id} className="professor-chat__message">
          <p className={`professor-chat__author ${message.isOwner ? 'professor-chat__author--professor' : 'professor-chat__author--student'}`}>
            {message.nickname}{message.isOwner && <span className="professor-chat__professor-badge">교수</span>}
          </p>
          {message.parentId !== null && <p className="professor-chat__quote">{message.parentPreview ?? '삭제된 메시지'}</p>}
          <button type="button" disabled={!chat.ready} onClick={() => setReply(message)}
            aria-label={`${message.nickname}의 메시지에 답글: ${message.content}`}
            className={`professor-chat__bubble ${message.isOwner ? 'professor-chat__bubble--professor' : 'professor-chat__bubble--student'}`}>{message.content}</button>
          {chat.roomId !== null && <ChatModeration roomId={chat.roomId} message={message} />}
        </article>)}
      </div>
      <ChatReactions reactions={reactions} />
    </div>
    {parent && <div className="professor-chat__reply"><span>답글: {parent.nickname}: {parent.content}</span><button type="button" onClick={() => setReply(null)}>취소</button></div>}
    <ChatComposer key={chat.roomId ?? 'none'} chat={chat} parentId={parent?.id ?? null} onSent={() => setReply(null)} placeholder="수업 안내나 답글을 입력하세요" />
  </section>
}
