import { ConfirmDialog } from '../../shared/components/ConfirmDialog'

export function RoomEndedNotice({ onHome }: { onHome: () => void }) {
  return <ConfirmDialog title="수업이 종료되었습니다" message="수업이 종료되었거나 더 이상 열 수 없습니다. 홈으로 이동해 주세요."
    cancelLabel="닫기" confirmLabel="홈으로" onCancel={onHome} onConfirm={onHome} />
}
