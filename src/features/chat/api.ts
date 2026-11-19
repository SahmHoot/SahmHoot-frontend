import { apiClient } from '../../shared/api/client'

export interface ChatAuthorResponse { participantId: number; nickname: string; email: string }
export interface ChatRestrictionResponse { participantId: number; nickname: string; chatBlocked: boolean }

export async function getChatAuthor(roomId: number, messageId: number): Promise<ChatAuthorResponse> {
  const { data } = await apiClient.get<ChatAuthorResponse>(`/rooms/${roomId}/messages/${messageId}/author`)
  return data
}
export async function setChatBlocked(roomId: number, participantId: number, chatBlocked: boolean): Promise<ChatRestrictionResponse> {
  const { data } = await apiClient.patch<ChatRestrictionResponse>(`/rooms/${roomId}/participants/${participantId}`, { chatBlocked })
  return data
}
export async function deleteChatMessage(roomId: number, messageId: number): Promise<void> {
  await apiClient.delete(`/rooms/${roomId}/messages/${messageId}`)
}
