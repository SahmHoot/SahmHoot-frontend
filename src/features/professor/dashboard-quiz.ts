import type { Question, QuizState } from './dashboard-types'

export const labels = ['①', '②', '③', '④']

export const initialQuiz: QuizState = { phase: 'waiting', index: 0, remaining: 0, set: null }

export function exampleResponses(participants: number, question: Question) {
  const total = Math.round(participants * 0.875)
  const correct = Math.round((total * 17) / 28)
  const incorrect = total - correct
  const wrongCounts =
    question.type === 'ox'
      ? [incorrect]
      : [Math.round((incorrect * 7) / 11), Math.round((incorrect * 3) / 11)]
  if (question.type === 'multiple') wrongCounts.push(incorrect - wrongCounts[0] - wrongCounts[1])
  let wrongIndex = 0
  const counts = question.options.map((_, index) =>
    index === question.answer ? correct : wrongCounts[wrongIndex++],
  )
  const percentages = counts.map((count) => (total ? Math.floor((count / total) * 100) : 0))
  if (total) {
    const remainder = 100 - percentages.reduce((sum, value) => sum + value, 0)
    const order = counts
      .map((count, index) => ({ index, fraction: (count / total) * 100 - percentages[index] }))
      .sort((a, b) => b.fraction - a.fraction)
    order.slice(0, remainder).forEach(({ index }) => percentages[index]++)
  }
  return { total, correct, incorrect, percentages }
}
