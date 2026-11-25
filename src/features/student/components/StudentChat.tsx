import { useEffect, useId, useRef, useState } from 'react'
import { ChatComposer } from '../../chat/ChatComposer'
import type { RoomChat } from '../../chat/useRoomChat'
import { ChatReactions } from '../../room/ChatReactions'
import type { FloatingReaction, Reaction } from '../../room/reactions'
import StudentReactionBar from './StudentReactionBar'
import pinIcon from '../../../assets/student/pin.svg'
import replyIcon from '../../../assets/student/reply.svg'
import './StudentChat.css'

export default function StudentChat({ expanded, chat, onlineCount, reactions, onReact, notices, realtimeNotice }: {
  expanded: boolean; chat: RoomChat; onlineCount: number; reactions: FloatingReaction[]
  onReact: (reaction: Reaction) => void; notices: { id: number; content: string }[]; realtimeNotice?: string
}) {
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 800px)').matches)
  const [read, setRead] = useState(chat.received)
  const bodyId = useId()
  const list = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const last = chat.messages[chat.messages.length - 1]?.id
  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => { if (open || expanded || !mobile) setRead(chat.received) }, [open, expanded, mobile, chat.received])
  useEffect(() => { if (open || expanded || !mobile) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }) }, [last, open, expanded, mobile])
  useEffect(() => {
    if (!open || !mobile || expanded) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open, mobile, expanded])
  const unread = open || expanded || !mobile ? 0 : Math.max(0, chat.received - read)
  return <aside className={`student-chat student-card ${expanded ? 'student-chat--expanded' : 'student-chat--sheet'} ${open ? 'student-chat--open' : ''}`} aria-label="수업 채팅">
    {!expanded && <button ref={toggle} className="student-chat__toggle" type="button" aria-controls={bodyId} aria-expanded={open}
      onClick={() => setOpen(!open)}>{open ? '채팅 닫기' : '채팅 열기'}{unread > 0 && <span className="student-chat__unread" aria-label={`${unread}개의 새 메시지`}>{unread}</span>}</button>}
    <div id={bodyId} className="student-chat__body">
      <div className="student-chat__heading"><h2>실시간 채팅</h2><span>접속 {onlineCount}명</span></div>
      <div role="status" className="student-chat__realtime-notice">{realtimeNotice}</div>
      {notices.length > 0 && <div className="student-chat__notices">{notices.map((notice) => <div key={notice.id} className="student-chat__notice"><img src={pinIcon} alt="" /><p>{notice.content}{expanded && <span className="student-muted"> · 교수 공지</span>}</p></div>)}</div>}
      <div className="chat-messages-area">
        <div ref={list} className="student-chat__messages" role="log" aria-label="채팅 메시지" aria-live="polite" aria-relevant="additions">
          {chat.messages.map((message) => <div key={message.id} className={`student-chat__message ${message.isOwner ? 'student-chat__message--professor' : ''} ${message.senderParticipantId === chat.meId ? 'student-chat__message--mine' : ''}`}>
            <p className="student-chat__author">{message.nickname}{message.isOwner && ' 교수'}{message.senderParticipantId === chat.meId && ' (나)'}</p>
            {message.parentId !== null && <p className="student-chat__reply"><img src={replyIcon} alt="답장" />{message.parentPreview ?? '삭제된 메시지'}</p>}
            <p className="student-chat__bubble">{message.content}</p>
          </div>)}
        </div>
        <ChatReactions reactions={reactions} />
      </div>
      <StudentReactionBar expanded={expanded} onReact={onReact} />
      <ChatComposer chat={chat} />
    </div>
  </aside>
}
