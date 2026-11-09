import "./JoinCode.css";
import { QRCodeSVG } from "qrcode.react";
import type { Room } from "../dashboard-types";

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
  const joinUrl = room.code
    ? room.joinUrl ?? `${window.location.origin}/join/${room.code}`
    : "";
  const size = large || create ? 160 : 96;
  return (
    <section
      aria-label="수업 입장 정보"
      className={`join-code ${large ? "join-code--waiting" : create ? "join-code--create" : "join-code--compact"}`}
    >
      <div
        className={`join-code__qr ${large || create ? "join-code__qr--large" : "join-code__qr--compact"}`}
      >
        {joinUrl ? (
          <QRCodeSVG
            value={joinUrl}
            size={size}
            marginSize={4}
            level="M"
            title={`입장 코드 ${room.code} 수업 QR 코드`}
          />
        ) : (
          <div className="join-code__placeholder" role="status">
            수업 개설 후<br />QR 코드가 표시됩니다
          </div>
        )}
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
          입장 코드 <span className="join-code__code">{room.code || "------"}</span>
        </p>
        {joinUrl && (
          <p className="join-code__url">{joinUrl.replace(/^https?:\/\//, "")}</p>
        )}
      </div>
    </section>
  );
}
