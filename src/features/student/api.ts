import { apiClient } from '../../shared/api/client'
import type { JoinRoomResponse, RoomByCodeResponse } from './types/student.types'

export async function getRoomByCode(code: string): Promise<RoomByCodeResponse> {
  const { data } = await apiClient.get<RoomByCodeResponse>(`/rooms/by-code/${code}`)
  return data
}

export async function joinRoom(code: string, nickname: string): Promise<JoinRoomResponse> {
  const { data } = await apiClient.post<JoinRoomResponse>(`/rooms/by-code/${code}/participants`, { nickname })
  return data
}
