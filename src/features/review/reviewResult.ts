import type { QuestionResponse } from '../questionset/questionset.types'

export type ReviewAnswers = Record<number, number | undefined>

export function reviewResult(questions: QuestionResponse[], answers: ReviewAnswers) {
  const total = questions.length
  const correct = questions.filter(question => question.choices.some(choice =>
    choice.id === answers[question.id] && choice.isCorrect)).length
  const answered = questions.filter(question => answers[question.id] !== undefined).length
  return { total, correct, wrong: answered - correct, unanswered: total - answered,
    rate: total === 0 ? 0 : Math.round(correct / total * 100) }
}
