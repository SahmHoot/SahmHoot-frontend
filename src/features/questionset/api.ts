import { isAxiosError } from 'axios'
import { apiClient } from '../../shared/api/client'
import type { ImageUpload } from './questionImage'
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

export async function uploadQuestionImage(setId: number, file: File): Promise<ImageUpload> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post<ImageUpload>(`/question-sets/${setId}/images`, form, {
    headers: { 'Content-Type': undefined },
  })
  return data
}

export function imageErrorMessage(error: QuestionSetErrorResponse, fallback: string) {
  if (error.status === 413 || error.code === 'IMAGE_TOO_LARGE') return '이미지 용량은 5 MiB 이하여야 합니다.'
  if (error.status === 401) return '다시 로그인한 뒤 이미지 요청을 시도해 주세요.'
  if (error.status === 403) return '이미지에 접근할 권한이 없습니다.'
  switch (error.code) {
    case 'VALIDATION_FAILED': return '이미지 파일 형식, 용량, 해상도를 확인해 주세요.'
    case 'QUESTION_IMAGE_NOT_FOUND': return '서버에서 이미지를 찾을 수 없습니다.'
    case 'QUESTION_IMAGE_NOT_AVAILABLE': return '이미지 연결을 완료하지 못했습니다. 다시 저장해 주세요.'
    case 'UNSUPPORTED_IMAGE_FORMAT': return 'JPEG 또는 PNG 파일을 선택해 주세요.'
    case 'IMAGE_STORAGE_UNAVAILABLE': return '이미지 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'
    default: return fallback
  }
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
