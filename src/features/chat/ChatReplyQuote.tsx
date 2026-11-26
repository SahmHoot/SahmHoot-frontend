import './Chat.css'

/**
 * 카카오톡 답장처럼 말풍선 안 위쪽에 「OO에게 답장」과 원문 한 줄을 붙인다.
 * 서버는 원문 작성자를 보내지 않아서 화면에 있는 메시지에서 찾고, 못 찾으면 「답장」만 쓴다.
 */
export function ChatReplyQuote({ nickname, preview }: { nickname: string | undefined; preview: string | null }) {
  return <span className="chat-reply-quote">
    <span className="chat-reply-quote__to">{nickname ? `${nickname}에게 답장` : '답장'}</span>
    <span className="chat-reply-quote__text">{preview ?? '삭제된 메시지'}</span>
  </span>
}
