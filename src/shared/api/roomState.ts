import { apiClient } from './client'
import type { RoomStateResponse } from '../types/roomState'

/** 응답이 오지 않는 조회를 끝없이 기다리지 않는다. 시간이 지나면 실패로 보고 다시 시도한다. */
const STATE_TIMEOUT_MS = 10_000

/** 05 #21 수업 상태 스냅샷. 입장·새로고침·재연결 때 shared/stomp의 동기화 모듈이 부른다. */
export async function fetchRoomState(roomId: number, signal?: AbortSignal): Promise<RoomStateResponse> {
  const { data } = await apiClient.get<RoomStateResponse>(`/rooms/${roomId}/state`, {
    signal,
    timeout: STATE_TIMEOUT_MS,
  })
  return data
}
