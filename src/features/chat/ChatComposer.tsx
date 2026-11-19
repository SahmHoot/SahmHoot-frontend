import { useState } from 'react'
import type { FormEvent } from 'react'
import type { RoomChat } from './useRoomChat'
import './Chat.css'
import sendIcon from '../../assets/student/send.svg'

export function ChatComposer({ chat, parentId = null, onSent, placeholder = '질문이나 의견을 남겨보세요' }: { chat: RoomChat; parentId?: number | null; onSent?: () => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const disabled = !chat.ready || chat.blocked
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled || chat.sending) return
    if (await chat.send(draft, parentId)) { setDraft(''); onSent?.() }
  }
  return <form className="room-chat-composer" onSubmit={(event) => void submit(event)}>
    {chat.blocked && <p role="status">교수님이 채팅을 제한했습니다.</p>}
    {chat.error && <p role="alert">{chat.error}</p>}
    <div className="room-chat-composer__row">
      <textarea aria-label="채팅 메시지" value={draft} maxLength={600} rows={2} disabled={disabled} readOnly={chat.sending}
        placeholder={chat.ready ? placeholder : '수업에 연결하는 중입니다'} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
        }} />
      <button type="submit" disabled={disabled || chat.sending || !draft.trim()}><img src={sendIcon} alt="" width={16} height={16} />{chat.sending ? '전송 중…' : '전송'}</button>
    </div>
    <span className="room-chat-composer__count">{[...draft].length} / 300자</span>
  </form>
}
