import "./Reactions.css";
import { REACTION_EMOJIS } from "../../room/reactions";
import type { ReactionStats } from "../../room/reactions";

export function Reactions({ participants, stats }: { participants: number; stats: ReactionStats | null }) {
  const maxCount = stats ? Math.max(...REACTION_EMOJIS.map((emoji) => stats[emoji])) : 0;
  return (
    <section className="professor-reactions">
      <div className="professor-reactions__header">
        <h2 className="professor-reactions__title">학생 반응 (최근 1분)</h2>
        <span className="professor-reactions__participants">
          접속 {participants}명
        </span>
      </div>
      {stats ? <ul className="professor-reactions__list">
        {REACTION_EMOJIS.map((emoji) => (
          <li key={emoji}>
            <div className="professor-reactions__item">
              <span
                className="professor-reactions__emoji"
                aria-label={emoji === "❓" ? "질문" : undefined}
              >
                {emoji}
              </span>
              <span className="professor-reactions__track">
                <span
                  className={`professor-reactions__fill ${emoji === "❓" ? "professor-reactions__fill--question" : "professor-reactions__fill--default"}`}
                  style={{ width: `${maxCount === 0 ? 0 : stats[emoji] / maxCount * 100}%` }}
                />
              </span>
              <strong className="professor-reactions__count">
                {stats[emoji]}
              </strong>
            </div>
          </li>
        ))}
      </ul> : <p className="professor-reactions__participants">반응 집계를 확인할 수 없습니다.</p>}
    </section>
  );
}
