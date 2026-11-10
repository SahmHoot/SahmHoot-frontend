import "./Modal.css";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  onClose,
  closable = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  closable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="professor-dialog-title"
      onCancel={(event) => {
        if (!closable) event.preventDefault();
        else onClose();
      }}
      className="professor-modal"
    >
      <div className="professor-modal__header">
        <h2 id="professor-dialog-title" className="professor-modal__title">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={!closable}
          className="professor-modal__close-button"
        >
          닫기
        </button>
      </div>
      {children}
    </dialog>
  );
}
