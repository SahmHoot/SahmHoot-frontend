import { apiClient } from '../../shared/api/client'
import { getQuestionSet } from '../questionset/api'
import type { QuestionSetDetailResponse } from '../questionset/questionset.types'

export interface PublicQuestionSetSummaryResponse {
  id: number
  title: string
  ownerName: string
  questionCount: number
  updatedAt: string
}

export interface PublicQuestionSetPageResponse {
  content: PublicQuestionSetSummaryResponse[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export async function getPublicQuestionSets(page: number): Promise<PublicQuestionSetPageResponse> {
  const { data } = await apiClient.get<PublicQuestionSetPageResponse>('/question-sets/public', {
    params: { page, size: 20 },
  })
  return data
}

export async function getReviewSet(setId: string): Promise<QuestionSetDetailResponse> {
  if (!/^[1-9]\d*$/.test(setId) || !Number.isSafeInteger(Number(setId))) {
    throw new Error('올바른 문제 세트 주소가 아닙니다.')
  }
  const data = await getQuestionSet(Number(setId))
  // 상세 공용 API는 소유자의 PRIVATE 세트도 허용하지만 복습은 공개 세트만 제공한다.
  if (data.visibility !== 'PUBLIC') throw new Error('비공개 문제 세트는 복습할 수 없습니다.')
  return {
    ...data,
    questions: [...data.questions].sort((a, b) => a.orderNo - b.orderNo).map(question => ({
      ...question,
      choices: [...question.choices].sort((a, b) => a.orderNo - b.orderNo),
    })),
  }
}
