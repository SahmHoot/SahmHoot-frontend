import type { QuizState } from './dashboard-types'

export const labels = ['①', '②', '③', '④']

export const initialQuiz: QuizState = { phase: 'waiting', index: 0, remaining: 0, set: null }

/** 선택지 앞 표시. OX는 내용이 곧 표시이고, 객관식은 순서 번호를 쓴다. */
export function choiceLabel(choice: { orderNo: number; content: string }): string {
  return choice.content === 'O' || choice.content === 'X'
    ? choice.content
    : labels[choice.orderNo - 1]
}

/** 인원 수를 합이 100이 되는 정수 백분율로 바꾼다. 응답이 없으면 모두 0이다. */
export function percentagesOf(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return counts.map(() => 0)
  const percentages = counts.map((count) => Math.floor((count / total) * 100))
  const remainder = 100 - percentages.reduce((sum, value) => sum + value, 0)
  counts
    .map((count, index) => ({ index, fraction: (count / total) * 100 - percentages[index] }))
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, remainder)
    .forEach(({ index }) => percentages[index]++)
  return percentages
}
