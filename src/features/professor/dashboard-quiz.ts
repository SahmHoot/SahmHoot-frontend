import type { Question, QuizState, RoomQuestionSet } from './dashboard-types'

export const labels = ['①', '②', '③', '④']

export const initialQuiz: QuizState = { phase: 'waiting', index: 0, remaining: 0, set: null }

export function startQuiz(set: RoomQuestionSet): QuizState {
  if (set.questions.length === 0) return initialQuiz
  return { phase: 'running', index: 0, remaining: set.questions[0].timeLimitSeconds, set: structuredClone(set) }
}

/** 기존 3초 문항 간 대기와 결과 전환을 유지하고 다음 문항의 시간을 적용한다. */
export function advanceQuiz(current: QuizState): QuizState {
  if (current.phase !== 'running' && current.phase !== 'between') return current
  if (!current.set || !current.set.questions[current.index]) return initialQuiz
  if (current.remaining > 1) return { ...current, remaining: current.remaining - 1 }
  const next = current.set.questions[current.index + 1]
  if (current.phase === 'running') return next
    ? { ...current, phase: 'between', remaining: 3 }
    : { ...current, phase: 'results', remaining: 0 }
  return next ? { ...current, phase: 'running', index: current.index + 1, remaining: next.timeLimitSeconds }
    : { ...current, phase: 'results', remaining: 0 }
}

export function exampleResponses(participants: number, question: Pick<Question, 'type' | 'options' | 'answer'>) {
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
