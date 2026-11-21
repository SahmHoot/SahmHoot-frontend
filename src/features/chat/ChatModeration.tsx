import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toApiError } from '../auth/api'
import { Modal } from '../professor/components/Modal'
import { ConfirmDialog } from '../../shared/components/ConfirmDialog'
import type { RoomChatMessage } from '../../shared/types/roomState'
import { deleteChatMessage, getChatAuthor, setChatBlocked } from './api'
import type { ChatAuthorResponse } from './api'
import { pinMessage } from '../room/api'

export function ChatModeration({ roomId, message }: { roomId: number; message: RoomChatMessage }) {
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
  return <div className="room-chat-moderation">
    <details><summary aria-label={`${message.nickname} 메시지 관리`}>관리</summary>
      <div className="room-chat-moderation__menu">
        <button disabled={pending} onClick={() => void run(async () => { await pinMessage(roomId, message.id); setStatus('공지를 고정했습니다.') })}>공지 고정</button>
        {!message.isOwner && <button disabled={pending} onClick={() => void run(async () => { setAuthor(await getChatAuthor(roomId, message.id)) })}>작성자 확인</button>}
        {!message.isOwner && [true, false].map((blocked) => <button key={String(blocked)} disabled={pending}
          onClick={() => void run(async () => { const result = await setChatBlocked(roomId, message.senderParticipantId, blocked); setStatus(`${result.nickname} 채팅 ${result.chatBlocked ? '제한' : '제한 해제'} 완료`) })}>{blocked ? '채팅 제한' : '채팅 제한 해제'}</button>)}
        <button disabled={pending} onClick={() => setDeleting(true)}>메시지 삭제</button>
      </div>
    </details>
    {error && <p role="alert">{error}</p>}{status && <p role="status">{status}</p>}
    {deleting && createPortal(<ConfirmDialog title="메시지를 삭제할까요?" message="삭제한 메시지는 모든 참가자에게서 사라지며 복구할 수 없습니다."
      confirmLabel="삭제하기" cancelLabel="취소" onCancel={() => setDeleting(false)}
      onConfirm={() => { setDeleting(false); void run(() => deleteChatMessage(roomId, message.id)) }} />, document.body)}
    {author && createPortal(<Modal title="메시지 작성자" onClose={() => setAuthor(null)}><p>{author.nickname}</p><p>{author.email}</p></Modal>, document.body)}
  </div>
}
