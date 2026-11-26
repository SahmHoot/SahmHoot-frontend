import './Chat.css'
import { useEffect, useId, useRef, useState } from 'react'
import { ChatAvatar } from '../../chat/ChatAvatar'
import { ChatComposer } from '../../chat/ChatComposer'
import { chatTime, groupChat } from '../../chat/chatGroups'
import { ChatModeration } from '../../chat/ChatModeration'
import { createLongPress } from '../../chat/longPress'
import type { RoomChat } from '../../chat/useRoomChat'
import type { RoomChatMessage } from '../../../shared/types/roomState'
import { ChatReactions } from '../../room/ChatReactions'
import type { FloatingReaction } from '../../room/reactions'
import { Icon } from './Icon'

export function Chat({ compact, screen, chat, reactions, notices, onUnpin, participants }: {
  compact: boolean; participants: number; screen: 'waiting' | 'quiz' | 'results'; chat: RoomChat; reactions: FloatingReaction[]
  notices: { id: number; content: string }[]; onUnpin: (messageId: number) => void
}) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const [reply, setReply] = useState<RoomChatMessage | null>(null)
  const list = useRef<HTMLDivElement>(null)
  // 휴대폰은 말풍선을 꾹 누르면 옆의 숨은 ▾(관리)를 눌러 그 메시지 메뉴를 연다.
  const press = useRef(createLongPress((bubble) => bubble.parentElement?.querySelector<HTMLButtonElement>('.room-chat-moderation__trigger')?.click())).current
  const last = chat.messages[chat.messages.length - 1]?.id
  useEffect(() => { if (open) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [last, open])
  const parent = reply && chat.messages.some(({ id }) => id === reply.id) ? reply : null
  return <section aria-label="수업 채팅" className={`professor-chat ${compact ? 'professor-chat--compact' : 'professor-chat--expanded'} ${open ? '' : 'professor-chat--closed'}`}>
    <div className="professor-chat__header"><div className="professor-chat__heading"><h2 className="professor-chat__title">실시간 채팅</h2><span className="professor-chat__count">접속 {participants}명</span></div>
      <button type="button" className="professor-chat__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>{open ? '채팅 닫기' : '채팅 열기'}</button>
    </div>
    <div id={bodyId} className="professor-chat__body" hidden={!open}>
    {notices.length > 0 && <div className="professor-chat__notices">{notices.map((notice) => <div key={notice.id} className="professor-chat__notice">
      <Icon screen={screen} name="imgFrame4" className="professor-chat__notice-icon" />
      <span className="professor-chat__notice-body">
        {compact && <span className="professor-chat__notice-author">고정 공지 (교수)</span>}
        <span className="professor-chat__notice-text">{notice.content}</span>
        {!compact && <span className="professor-chat__notice-caption"> · 교수 공지</span>}
      </span>
      <button type="button" onClick={() => onUnpin(notice.id)} aria-label={`고정 해제: ${notice.content}`} className="professor-chat__unpin-button">해제</button>
    </div>)}</div>}
    <div className="chat-messages-area">
      <div ref={list} className="professor-chat__messages" role="log" aria-label="채팅 메시지" aria-live="polite" aria-relevant="additions">
        {groupChat(chat.messages).map((group) => {
          const [first] = group
          return <article key={first.id} className="professor-chat__message">
            <p className={`professor-chat__author ${first.isOwner ? 'professor-chat__author--professor' : 'professor-chat__author--student'}`}>
              <ChatAvatar name={first.nickname} participantId={first.senderParticipantId} isOwner={first.isOwner} />
              {first.nickname}{first.isOwner && ' 교수'}
            </p>
            {group.map((message, index) => <div key={message.id} className="professor-chat__line">
              {message.parentId !== null && <p className="professor-chat__quote"><Icon screen={screen} name="imgFrame5" alt="답장" />{message.parentPreview ?? '삭제된 메시지'}</p>}
              <div className="chat-bubble-row">
                <button type="button" disabled={!chat.ready} onClick={() => { if (!press.handled()) setReply(message) }}
                  onPointerDown={press.onPointerDown} onPointerUp={press.onPointerUp} onPointerCancel={press.onPointerCancel}
                  onPointerLeave={press.onPointerLeave} onContextMenu={press.onContextMenu}
                  aria-label={`${message.nickname}의 메시지에 답글: ${message.content}`}
                  className={`professor-chat__bubble ${message.isOwner ? 'professor-chat__bubble--professor' : 'professor-chat__bubble--student'}`}>{message.content}</button>
                {chat.roomId !== null && <ChatModeration roomId={chat.roomId} message={message} />}
                {index === group.length - 1 && <time className="chat-time" dateTime={message.createdAt}>{chatTime(message.createdAt)}</time>}
              </div>
            </div>)}
          </article>
        })}
      </div>
      <ChatReactions reactions={reactions} />
    </div>
    {parent && <div className="professor-chat__reply"><span>답글: {parent.nickname}: {parent.content}</span><button type="button" onClick={() => setReply(null)}>취소</button></div>}
    <ChatComposer key={chat.roomId ?? 'none'} chat={chat} parentId={parent?.id ?? null} onSent={() => setReply(null)} placeholder="수업 안내나 답글을 입력하세요" />
    </div>
  </section>
}
