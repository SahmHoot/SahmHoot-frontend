import "./Status.css";
export function Status({ waiting = false }: { waiting?: boolean }) {
  return (
    <span className="professor-status">
      진행 중{waiting ? " · 문제 없음" : ""}
    </span>
  );
}
