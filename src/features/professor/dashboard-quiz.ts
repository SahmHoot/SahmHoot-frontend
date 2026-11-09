export const labels = ['①', '②', '③', '④']

/** 선택지 앞 표시. 서버가 OX는 2개, 객관식은 4개만 허용하므로 개수로 구분한다. */
export function choiceLabel(choice: { orderNo: number; content: string }, choiceCount: number) {
  return choiceCount === 2 ? choice.content : labels[choice.orderNo - 1]
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
