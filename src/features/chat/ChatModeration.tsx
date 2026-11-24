import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toApiError } from '../auth/api'
import { Modal } from '../professor/components/Modal'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import type { RoomChatMessage } from '../../shared/types/roomState'
import { deleteChatMessage, getChatAuthor, setChatBlocked } from './api'
import type { ChatAuthorResponse } from './api'
import { pinMessage } from '../room/api'
import './Chat.css'

const actionIcons = {
  pin: 'M16 3l5 5-3 1-4 4v4l-2 2-7-7 2-2h4l4-4 1-3ZM8 16l-5 5',
  author: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  block: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM5 5l14 14',
  unblock: 'M5 12l4 4L19 6',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
}

export function ChatModeration({ roomId, message }: { roomId: number; message: RoomChatMessage }) {
  const menuId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [author, setAuthor] = useState<ChatAuthorResponse | null>(null)
  const [status, setStatus] = useState('')
  const [deleting, setDeleting] = useState(false)
  async function run(action: () => Promise<void>) {
    if (pending) return
    setPending(true); setError(''); setStatus('')
    try { await action() } catch (failure) { setError(toApiError(failure).message) } finally { setPending(false) }
  }
  function action(icon: keyof typeof actionIcons, label: string, onSelect: () => void) {
    return <button type="button" key={icon} disabled={pending}
      onClick={() => {
        menu.current?.hidePopover()
        trigger.current?.focus()
        onSelect()
      }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={actionIcons[icon]} />
      </svg>
      {label}
    </button>
  }
  return <div className="room-chat-moderation">
    <button type="button" ref={trigger} className="room-chat-moderation__trigger" popoverTarget={menuId}
      aria-label={`${message.nickname} 메시지 관리`}>관리</button>
    <div id={menuId} ref={menu} popover="auto" role="group" aria-label="메시지 관리"
      className="room-chat-moderation__menu">
      {action('pin', '공지 고정', () => void run(async () => { await pinMessage(roomId, message.id); setStatus('공지를 고정했습니다.') }))}
      {!message.isOwner && action('author', '작성자 확인', () => void run(async () => { setAuthor(await getChatAuthor(roomId, message.id)) }))}
      {!message.isOwner && [true, false].map((blocked) => action(blocked ? 'block' : 'unblock', blocked ? '채팅 제한' : '채팅 제한 해제',
        () => void run(async () => {
          const result = await setChatBlocked(roomId, message.senderParticipantId, blocked)
          setStatus(`${result.nickname} 채팅 ${result.chatBlocked ? '제한' : '제한 해제'} 완료`)
        })))}
      {action('delete', '메시지 삭제', () => setDeleting(true))}
    </div>
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    {deleting && createPortal(<ConfirmDialog title="메시지를 삭제할까요?" message="삭제한 메시지는 모든 참가자에게서 사라지며 복구할 수 없습니다."
      confirmLabel="삭제하기" cancelLabel="취소" onCancel={() => setDeleting(false)}
      onConfirm={() => { setDeleting(false); void run(() => deleteChatMessage(roomId, message.id)) }} />, document.body)}
    {author && createPortal(<Modal title="메시지 작성자" onClose={() => setAuthor(null)}><p>{author.nickname}</p><p>{author.email}</p></Modal>, document.body)}
  </div>
}
