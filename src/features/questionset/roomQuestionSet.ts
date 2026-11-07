import type { QuestionSetDetailResponse } from './questionset.types'
import type { RoomQuestionSet } from '../professor/dashboard-types'

export class RoomQuestionSetError extends Error {}

export function toRoomQuestionSet(detail: QuestionSetDetailResponse): RoomQuestionSet {
  if (detail.questions.length === 0) throw new RoomQuestionSetError('선택한 세트에 문항이 없습니다. 세트를 편집한 뒤 목록을 새로 불러와 주세요.')
  return {
    id: detail.id, name: detail.title, isPublic: detail.visibility === 'PUBLIC',
    questions: [...detail.questions].sort((a, b) => a.orderNo - b.orderNo).map((question) => {
      const choices = question.choices.map((choice) => ({ ...choice })).sort((a, b) => a.orderNo - b.orderNo)
      if (choices.length !== (question.type === 'TRUE_FALSE' ? 2 : 4)
        || choices.filter((choice) => choice.isCorrect).length !== 1
        || (question.type === 'TRUE_FALSE' && choices.map((choice) => choice.content).sort().join(',') !== 'O,X')
        || !Number.isInteger(question.timeLimitSeconds) || question.timeLimitSeconds < 10 || question.timeLimitSeconds > 300) {
        throw new RoomQuestionSetError('문항의 선택지·정답·제한시간을 확인할 수 없습니다. 세트를 편집한 뒤 다시 선택해 주세요.')
      }
      return { id: question.id, orderNo: question.orderNo, title: question.content, prompt: question.content,
        type: question.type === 'TRUE_FALSE' ? 'ox' : 'multiple', timeLimitSeconds: question.timeLimitSeconds,
        choices, options: choices.map((choice) => choice.content), answer: choices.findIndex((choice) => choice.isCorrect) }
    }),
  }
}
