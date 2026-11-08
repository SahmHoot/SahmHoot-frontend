import "./EndClassDialog.css";
import { Modal } from "./Modal";

export function EndClassDialog({
  roomName,
  pending = false,
  error = "",
  onCancel,
  onConfirm,
}: {
  roomName: string;
  pending?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="수업 종료" onClose={onCancel}>
      <p className="end-class-dialog__message">
        ‘{roomName}’ 수업을 종료할까요?
      </p>
      {error && (
        <p role="alert" className="end-class-dialog__error">
          {error}
        </p>
      )}
      <div className="end-class-dialog__actions">
        <button
          type="button"
          className="end-class-dialog__cancel-button"
          onClick={onCancel}
          disabled={pending}
        >
          취소
        </button>
        <button
          type="button"
          className="end-class-dialog__confirm-button"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "종료하는 중…" : "수업 종료"}
        </button>
      </div>
    </Modal>
  );
}
