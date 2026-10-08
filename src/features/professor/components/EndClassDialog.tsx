import './EndClassDialog.css'
import { Modal } from './Modal'

export function EndClassDialog({
  roomName,
  onCancel,
  onConfirm,
}: {
  roomName: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title="수업 종료" onClose={onCancel}>
      <p className="end-class-dialog__message">‘{roomName}’ 수업을 종료할까요?</p>
      <div className="end-class-dialog__actions">
        <button type="button" className="end-class-dialog__cancel-button" onClick={onCancel}>
          취소
        </button>
        <button type="button" className="end-class-dialog__confirm-button" onClick={onConfirm}>
          수업 종료
        </button>
      </div>
    </Modal>
  )
}
