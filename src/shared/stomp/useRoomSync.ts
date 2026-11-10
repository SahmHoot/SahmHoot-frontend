import { useEffect, useRef } from 'react'
import { connectStomp } from './stompClient'
import { startRoomSync } from './roomSync'
import type { RoomSyncOptions } from './roomSync'

type Handlers = Pick<RoomSyncOptions, 'onSnapshot' | 'onMessage' | 'onSyncError'>

/**
 * 방 화면에서 쓰는 동기화 훅. roomId나 owner가 바뀌면 다시 시작하고, 화면을 떠나면 정리한다.
 * 핸들러는 매 렌더의 최신 함수를 쓰므로 useCallback으로 감쌀 필요가 없다.
 *
 * @example
 * useRoomSync(roomId, isOwner, {
 *   onSnapshot: (state) => dispatch({ kind: 'snapshot', state }),
 *   onMessage: (channel, message) => dispatch({ kind: 'message', channel, message }),
 *   onSyncError: (error) => showError(toApiError(error).message),
 * })
 */
export function useRoomSync(roomId: number | null, owner: boolean, handlers: Handlers): void {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    if (roomId === null) {
      return
    }
    // 연결은 탭에 하나만 만들어지고 이미 연결돼 있으면 아무것도 하지 않는다. 설정은 AuthProvider가 한다.
    connectStomp()
    return startRoomSync({
      roomId,
      owner,
      onSnapshot: (state) => latest.current.onSnapshot(state),
      onMessage: (channel, message) => latest.current.onMessage(channel, message),
      onSyncError: (error) => latest.current.onSyncError?.(error),
    })
  }, [roomId, owner])
}
