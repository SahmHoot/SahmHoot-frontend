import { apiClient } from '../../shared/api/client'
import type { StartQuizResponse } from './types'

/** 05 #23 퀴즈 시작. 화면 전환은 응답이 아니라 QUESTION_OPENED 메시지로 한다. */
export async function startQuiz(roomId: number, questionSetId: number): Promise<StartQuizResponse> {
  const { data } = await apiClient.post<StartQuizResponse>(`/rooms/${roomId}/quiz-runs`, {
    questionSetId,
  })
  return data
}

/** 05 #24 퀴즈 중단. 성공 204, 이후 QUIZ_CANCELED가 온다. */
export async function abortQuiz(roomId: number, runId: number): Promise<void> {
  await apiClient.delete(`/rooms/${roomId}/quiz-runs/${runId}`)
}

/** 05 #25 결과 닫기. 성공 204, 이후 ROOM_WAITING이 온다. */
export async function closeQuizResults(roomId: number): Promise<void> {
  await apiClient.post(`/rooms/${roomId}/wait`)
}
