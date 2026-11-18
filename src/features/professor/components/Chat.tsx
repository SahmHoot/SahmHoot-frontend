import "./Chat.css";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage } from "../dashboard-types";
import { ChatReactions } from "../../room/ChatReactions";
import type { FloatingReaction } from "../../room/reactions";
import { Icon } from "./Icon";

export function Chat({
  compact,
  screen,
  messages,
  reactions,
  onSend,
  notices,
  onUnpin,
}: {
  compact: boolean;
  screen: "waiting" | "quiz" | "results";
  messages: ChatMessage[];
  reactions: FloatingReaction[];
  onSend: (text: string, reply?: string) => void;
  /** 고정 공지(05 #21 pinnedMessages). 고정한 순서로 모두 보여 준다. */
  notices: { id: number; content: string }[];
  onUnpin: (messageId: number) => void;
}) {
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | undefined>();
  const listRef = useRef<HTMLDivElement>(null);
  const lastMessage = useRef(messages[messages.length - 1]?.id);
  useEffect(() => {
    if (lastMessage.current !== messages[messages.length - 1]?.id) {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
      lastMessage.current = messages[messages.length - 1]?.id;
    }
  }, [messages]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim(), reply);
    setText("");
    setReply(undefined);
  };
  return (
    <section
      aria-label="수업 채팅"
      className={`professor-chat ${compact ? "professor-chat--compact" : "professor-chat--expanded"}`}
    >
      <div className="professor-chat__header">
        <h2 className="professor-chat__title">
          {compact ? "전체" : "실시간 채팅"}
        </h2>
        {!compact && (
          <span className="professor-chat__layout-help">
            퀴즈를 출제하면 이 영역이 오른쪽 사이드바로 줄어듭니다
          </span>
        )}
      </div>
      {notices.map((notice) => (
        <div key={notice.id} className="professor-chat__notice">
          <Icon
            screen={screen}
            name="imgFrame4"
            className="professor-chat__notice-icon"
          />
          <span className="professor-chat__notice-body">
            {compact && (
              <span className="professor-chat__notice-author">
                고정 공지 (교수)
              </span>
            )}
            <span className="professor-chat__notice-text">{notice.content}</span>
            {!compact && (
              <span className="professor-chat__notice-caption"> · 교수 공지</span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onUnpin(notice.id)}
            aria-label={`고정 해제: ${notice.content}`}
            className="professor-chat__unpin-button"
          >
            해제
          </button>
        </div>
      ))}
      <div className="chat-messages-area">
        <div ref={listRef} className="professor-chat__messages">
          {messages.map((message) => (
            <article key={message.id} className="professor-chat__message">
              <p
                className={`professor-chat__author ${message.professor ? "professor-chat__author--professor" : "professor-chat__author--student"}`}
              >
                {message.author}
                {message.professor && (
                  <span className="professor-chat__professor-badge">교수</span>
                )}
              </p>
              {message.reply && (
                <p className="professor-chat__quote">
                  <Icon screen={screen} name="imgFrame5" />
                  <span className="professor-chat__quote-text">
                    {message.reply}
                  </span>
                </p>
              )}
              <button
                type="button"
                onClick={() => setReply(`${message.author}: ${message.text}`)}
                aria-label={`${message.author}의 메시지에 답글: ${message.text}`}
                className={`professor-chat__bubble ${message.professor ? "professor-chat__bubble--professor" : "professor-chat__bubble--student"}`}
              >
                {message.text}
              </button>
            </article>
          ))}
        </div>
        <ChatReactions reactions={reactions} />
      </div>
      {reply && (
        <div className="professor-chat__reply">
          <span className="professor-chat__reply-text">답글: {reply}</span>
          <button
            type="button"
            onClick={() => setReply(undefined)}
            className="professor-chat__cancel-reply"
          >
            취소
          </button>
        </div>
      )}
      <form onSubmit={submit} className="professor-chat__composer">
        <input
          aria-label="채팅 메시지"
          value={text}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            compact
              ? "메시지 입력"
              : "메시지 입력 · 학생 메시지를 클릭하면 답글"
          }
          className="professor-chat__message-input"
        />
        <button type="submit" className="professor-chat__send-button">
          <Icon screen={screen} name="imgFrame6" />
          전송
        </button>
      </form>
    </section>
  );
}
