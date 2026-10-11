import { useSyncExternalStore } from 'react'
import { getStompStatus, onStompStatus } from './stompClient'
import type { StompStatus } from './stompClient'

/** 연결 상태 표시용(예: "재연결 중…" 배너). */
export function useStompStatus(): StompStatus {
  return useSyncExternalStore(onStompStatus, getStompStatus)
}
