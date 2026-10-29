import { useEffect, useId, useRef } from 'react'
import './ConfirmDialog.css'

interface Props {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = '계속하기', onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={messageId} onCancel={onCancel}>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <div className="confirm-dialog__actions">
        <button type="button" className="confirm-dialog__cancel" autoFocus onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className="confirm-dialog__confirm" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  )
}
