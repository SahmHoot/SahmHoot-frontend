import "./JoinCode.css";
import type { Room } from "../dashboard-types";
import { Icon } from "./Icon";

export function JoinCode({
  room,
  variant,
  completed = false,
}: {
  room: Room;
  variant: "create" | "waiting" | "quiz" | "results";
  completed?: boolean;
}) {
  const large = variant === "waiting";
  const create = variant === "create";
  return (
    <section
      aria-label="수업 입장 정보"
      className={`join-code ${large ? "join-code--waiting" : create ? "join-code--create" : "join-code--compact"}`}
    >
      <div
        className={`join-code__qr ${large || create ? "join-code__qr--large" : "join-code__qr--compact"}`}
      >
        <Icon
          screen={variant}
          name="imgFrame2"
          alt={`입장 코드 ${room.code} 수업 QR 코드`}
        />
      </div>
      <div className="join-code__details">
        {create && (
          <p className="join-code__status">
            {completed ? "개설 완료" : "개설 완료 시 표시"}
          </p>
        )}
        <p
          className={`join-code__label ${large || create ? "join-code__label--large" : "join-code__label--compact"}`}
        >
          입장 코드 <span className="join-code__code">{room.code}</span>
        </p>
        <p className="join-code__url">sahmhoot.app/join/{room.code}</p>
      </div>
    </section>
  );
}
