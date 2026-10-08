import { demoSets } from './dashboard-data'
import type { QuestionSet } from './dashboard-types'

export const storageKey = 'sahmhoot.professor.question-sets.v1'

function validQuestionSet(value: unknown): value is QuestionSet {
  if (!value || typeof value !== 'object') return false
  const set = value as QuestionSet
  return (
    typeof set.id === 'string' &&
    typeof set.name === 'string' &&
    typeof set.isPublic === 'boolean' &&
    Number.isInteger(set.seconds) &&
    set.seconds >= 10 &&
    set.seconds <= 300 &&
    Array.isArray(set.questions) &&
    set.questions.length > 0 &&
    set.questions.every(
      (question) =>
        question &&
        typeof question.id === 'string' &&
        typeof question.title === 'string' &&
        typeof question.prompt === 'string' &&
        (question.type === 'multiple' || question.type === 'ox') &&
        Array.isArray(question.options) &&
        question.options.length === (question.type === 'multiple' ? 4 : 2) &&
        question.options.every((option) => typeof option === 'string') &&
        Number.isInteger(question.answer) &&
        question.answer >= 0 &&
        question.answer < question.options.length,
    )
  )
}

export function loadQuestionSets(): QuestionSet[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (
      Array.isArray(saved) &&
      saved.every(validQuestionSet) &&
      new Set(saved.map((set) => set.id)).size === saved.length
    )
      return saved
  } catch {
    /* Use design examples if browser storage is unavailable or invalid. */
  }
  return structuredClone(demoSets)
}
