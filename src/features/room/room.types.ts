/** 방 상태. 백엔드 RoomStatus 값을 그대로 쓴다. */
export type RoomStatus = 'OPEN' | 'PLAYING' | 'CLOSED'

/** POST /api/rooms 응답(CreateRoomResponse). */
export interface CreateRoomResponse {
  id: number
  title: string
  status: RoomStatus
  joinCode: string
  joinUrl: string
  createdAt: string
}

/** GET /api/rooms/mine 항목(RoomSummaryResponse). 종료된 방은 오지 않는다. */
export interface RoomSummaryResponse {
  id: number
  title: string
  status: RoomStatus
  joinCode: string
  onlineCount: number
  createdAt: string
}
