import { apiClient } from '../../shared/api/client'
import type { CreateRoomResponse, RoomSummaryResponse } from './room.types'

// 오류는 AxiosError 그대로 전파한다. 호출 측에서 toApiError로 변환한다.

/** 05 #16 수업 방 개설. 성공 201. 수업명은 1~50자, 교수만 호출할 수 있다. */
export async function createRoom(title: string): Promise<CreateRoomResponse> {
  const { data } = await apiClient.post<CreateRoomResponse>('/rooms', { title })
  return data
}

/** 내 수업 목록. 종료되지 않은 방만 최근 개설 순으로 온다. */
export async function fetchMyRooms(): Promise<RoomSummaryResponse[]> {
  const { data } = await apiClient.get<RoomSummaryResponse[]>('/rooms/mine')
  return data
}

/** 수업 종료. 성공 204. 이미 종료된 방도 204, 방 주인이 아니면 403 FORBIDDEN. */
export async function closeRoom(roomId: number): Promise<void> {
  await apiClient.patch(`/rooms/${roomId}/close`)
}
