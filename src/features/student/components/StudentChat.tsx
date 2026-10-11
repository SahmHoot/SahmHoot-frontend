import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import pin from '../../../assets/student/pin.svg'
import replyIcon from '../../../assets/student/reply.svg'
import send from '../../../assets/student/send.svg'
import StudentReactionBar from './StudentReactionBar'
import type { ChatMessage, FloatingReaction, Reaction } from '../types/student.types'
import './StudentChat.css'

interface Props {
  nickname: string
  expanded: boolean
  messages: ChatMessage[]
  reactions: FloatingReaction[]
  onSend: (text: string) => void
  onReact: (reaction: Reaction) => void
}

export default function StudentChat({ nickname, expanded, messages, reactions, onSend, onReact }: Props) {
  const [draft, setDraft] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const previousLength = useRef(messages.length)
  useEffect(() => {
    if (messages.length > previousLength.current && list.current) {
      list.current.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
    }
    previousLength.current = messages.length
  }, [messages.length])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <aside className={`student-chat student-card ${expanded ? 'student-chat--expanded' : ''}`} aria-label="수업 채팅">
      <div className="student-chat__heading"><h2>실시간 채팅</h2><span>{expanded ? `내 메시지는 ${nickname}으로 표시됩니다` : '32명 접속 중'}</span></div>
      <div className="student-chat__notice"><img src={pin} alt="" /><p>교재 42쪽 예제 먼저 보세요{expanded && <span className="student-muted"> · 교수 공지</span>}</p></div>
      <div className="student-chat__messages" ref={list} role="log" aria-label="채팅 메시지" aria-relevant="additions" aria-live="polite">
        {messages.map(message => (
          <div className={`student-chat__message ${message.role === 'professor' ? 'student-chat__message--professor' : ''} ${message.mine ? 'student-chat__message--mine' : ''}`} key={message.id}>
            <p className="student-chat__author">{message.nickname}{message.mine && ' (나)'}{message.role === 'professor' && <span>교수</span>}</p>
            {message.reply && <p className="student-chat__reply"><img src={replyIcon} alt="답장" />{message.reply}</p>}
            <p className="student-chat__bubble">{message.text}</p>
          </div>
        ))}
      </div>
      <div className="student-chat__floating" aria-live="polite" aria-atomic="false">
        {reactions.map((reaction, index) => <span key={reaction.id} className={`student-chat__reaction student-chat__reaction--${index % 4}`} aria-label={`${reaction.emoji} 반응`}>{reaction.emoji}</span>)}
      </div>
      <StudentReactionBar expanded={expanded} onReact={onReact} />
      <form className="student-chat__composer" onSubmit={submit}>
        <label className="student-visually-hidden" htmlFor="chat-message">채팅 메시지</label>
        <input id="chat-message" placeholder="질문이나 의견을 남겨보세요" value={draft} maxLength={500} autoComplete="off" onChange={event => setDraft(event.target.value)} />
        <button className="student-button student-button--primary" type="submit" disabled={!draft.trim()}><img src={send} alt="" />전송</button>
      </form>
    </aside>
  )
}
