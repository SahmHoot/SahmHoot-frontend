import { isAxiosError } from 'axios'
import { apiClient } from '../../shared/api/client'
import type {
  CreateQuestionSetRequest,
  QuestionResponse,
  QuestionSetDetailResponse,
  QuestionSetErrorResponse,
  QuestionSetSummaryResponse,
  QuestionWriteRequest,
  ReorderQuestionsRequest,
  UpdateQuestionSetRequest,
} from './questionset.types'

// 오류는 AxiosError 그대로 전파한다. 호출 측에서 toQuestionSetApiError로 변환할 수 있다.
export async function getMyQuestionSets(): Promise<QuestionSetSummaryResponse[]> {
  const { data } = await apiClient.get<QuestionSetSummaryResponse[]>('/question-sets/mine')
  return data
}

export async function createQuestionSet(
  request: CreateQuestionSetRequest,
): Promise<QuestionSetSummaryResponse> {
  const { data } = await apiClient.post<QuestionSetSummaryResponse>('/question-sets', request)
  return data
}

export async function getQuestionSet(setId: number): Promise<QuestionSetDetailResponse> {
  const { data } = await apiClient.get<QuestionSetDetailResponse>(`/question-sets/${setId}`)
  return data
}

export async function updateQuestionSet(
  setId: number,
  request: UpdateQuestionSetRequest,
): Promise<QuestionSetSummaryResponse> {
  const { data } = await apiClient.patch<QuestionSetSummaryResponse>(`/question-sets/${setId}`, request)
  return data
}

export async function deleteQuestionSet(setId: number): Promise<void> {
  await apiClient.delete(`/question-sets/${setId}`)
}

export async function addQuestion(
  setId: number,
  request: QuestionWriteRequest,
): Promise<QuestionResponse> {
  const { data } = await apiClient.post<QuestionResponse>(`/question-sets/${setId}/questions`, request)
  return data
}

export async function updateQuestion(
  setId: number,
  questionId: number,
  request: QuestionWriteRequest,
): Promise<QuestionResponse> {
  const { data } = await apiClient.put<QuestionResponse>(
    `/question-sets/${setId}/questions/${questionId}`,
    request,
  )
  return data
}

export async function deleteQuestion(setId: number, questionId: number): Promise<void> {
  await apiClient.delete(`/question-sets/${setId}/questions/${questionId}`)
}

export async function reorderQuestions(
  setId: number,
  request: ReorderQuestionsRequest,
): Promise<void> {
  await apiClient.put(`/question-sets/${setId}/questions/order`, request)
}

/** HTTP 응답이 없으면 status는 0, code는 NETWORK_ERROR. HTTP_ERROR는 비정형 응답용이다. */
export function toQuestionSetApiError(error: unknown): QuestionSetErrorResponse {
  if (isAxiosError(error) && error.response) {
    const data: unknown = error.response.data
    if (data && typeof data === 'object' && 'code' in data && 'message' in data
      && typeof data.code === 'string' && typeof data.message === 'string') {
      const fieldErrors = 'fieldErrors' in data && Array.isArray(data.fieldErrors)
        && data.fieldErrors.every((field: unknown) => field !== null && typeof field === 'object'
          && 'field' in field && typeof field.field === 'string'
          && 'message' in field && typeof field.message === 'string')
        ? data.fieldErrors as { field: string; message: string }[]
        : undefined
      return { status: error.response.status, code: data.code, message: data.message, fieldErrors }
    }
    return { status: error.response.status, code: 'HTTP_ERROR', message: '요청을 처리하지 못했습니다.' }
  }
  return { status: 0, code: 'NETWORK_ERROR', message: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }
}
