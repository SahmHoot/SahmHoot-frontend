import "./Chat.css";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage } from "../dashboard-types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function Chat({
  compact,
  screen,
  messages,
  onSend,
  participants,
}: {
  compact: boolean;
  screen: "waiting" | "quiz" | "results";
  messages: ChatMessage[];
  onSend: (text: string, reply?: string) => void;
  participants: number;
}) {
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | undefined>();
  const [notice, setNotice] = useState("교재 42쪽 예제 먼저 보세요");
  const [editingNotice, setEditingNotice] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState(notice);
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
        {compact ? (
          <button
            type="button"
            className="professor-chat__notice-button"
            aria-label="고정 공지 편집"
            onClick={() => {
              setNoticeDraft(notice);
              setEditingNotice(true);
            }}
          >
            <Icon screen={screen} name="img" />
          </button>
        ) : (
          <span className="professor-chat__layout-help">
            퀴즈를 출제하면 이 영역이 오른쪽 사이드바로 줄어듭니다
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          setNoticeDraft(notice);
          setEditingNotice(true);
        }}
        aria-label="고정 공지 편집"
        className="professor-chat__notice"
      >
        <Icon
          screen={screen}
          name="imgFrame4"
          className="professor-chat__notice-icon"
        />
        <span>
          {compact && (
            <span className="professor-chat__notice-author">
              고정 공지 (교수)
            </span>
          )}
          <span className="professor-chat__notice-text">{notice}</span>
          {!compact && (
            <span className="professor-chat__notice-caption"> · 교수 공지</span>
          )}
        </span>
      </button>
      <div ref={listRef} className="professor-chat__messages">
        {!compact && (
          <div className="professor-chat__reaction-preview">
            <span>👍❓👍😄</span>
            <span className="professor-chat__reaction-help">
              학생이 누른 이모지가 채팅 위로 잠깐 떠올랐다 사라집니다
            </span>
          </div>
        )}
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
      {compact && (
        <div className="professor-chat__reactions">
          <span>👍 {participants ? 12 : 0}</span>
          <span>❓ {participants ? 5 : 0}</span>
          <span>😄 {participants ? 3 : 0}</span>
          <span className="professor-chat__reactions-caption">
            학생이 보낸 반응
          </span>
        </div>
      )}
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
      {editingNotice && (
        <Modal title="고정 공지 편집" onClose={() => setEditingNotice(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (noticeDraft.trim()) {
                setNotice(noticeDraft.trim());
                setEditingNotice(false);
              }
            }}
          >
            <input
              aria-label="고정 공지 내용"
              className="professor-chat__notice-input"
              value={noticeDraft}
              onChange={(event) => setNoticeDraft(event.target.value)}
              required
              maxLength={150}
            />
            <button
              type="submit"
              className="professor-chat__save-notice-button"
            >
              공지 저장
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
