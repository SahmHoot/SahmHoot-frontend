import type { QuestionSetDetailResponse, QuestionWriteRequest } from './questionset.types'

export interface EditorQuestion {
  /** 화면용 키. 서버 ID와 혼용하지 않는다. */
  id: string
  serverId?: number
  prompt: string
  type: 'multiple' | 'ox'
  seconds: number
  options: string[]
  answer: number
}

export interface EditorDraft {
  name: string
  description: string
  isPublic: boolean
  questions: EditorQuestion[]
}

export function newQuestion(): EditorQuestion {
  return { id: `temp:${crypto.randomUUID()}`, prompt: '', type: 'multiple', seconds: 60,
    options: ['', '', '', ''], answer: 0 }
}

export function fromDetail(detail: QuestionSetDetailResponse): EditorDraft {
  return {
    name: detail.title,
    description: detail.description ?? '',
    isPublic: detail.visibility === 'PUBLIC',
    questions: [...detail.questions].sort((a, b) => a.orderNo - b.orderNo).map((question) => {
      const choices = [...question.choices].sort((a, b) => a.orderNo - b.orderNo)
      return { id: `server:${question.id}`, serverId: question.id, prompt: question.content,
        type: question.type === 'TRUE_FALSE' ? 'ox' : 'multiple', seconds: question.timeLimitSeconds,
        options: choices.map((choice) => choice.content), answer: choices.findIndex((choice) => choice.isCorrect) }
    }),
  }
}

export function questionRequest(question: EditorQuestion): QuestionWriteRequest {
  return {
    type: question.type === 'ox' ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE',
    content: question.prompt.trim(),
    timeLimitSeconds: question.seconds,
    choices: question.options.map((content, index) => ({ content: content.trim(), isCorrect: index === question.answer })),
  }
}

/** 오류를 띄울 입력칸. 문항 칸(제한시간·문제 내용·선택지)은 questionId로 어느 문항인지 함께 알려 준다. */
export type DraftField = 'name' | 'description' | 'seconds' | 'prompt' | 'options'
export interface DraftError { field: DraftField; message: string; questionId?: string }

export function isInvalidOption(option: string): boolean {
  return !option.trim() || option.length > 200
}

function optionsMessage(question: EditorQuestion): string | null {
  if (question.options.length !== (question.type === 'ox' ? 2 : 4)
    || question.options.some(isInvalidOption)) return '선택지 개수와 내용을 확인해 주세요. 선택지는 1~200자입니다.'
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) return '정답을 정확히 하나 선택해 주세요.'
  if (question.type === 'ox' && [...question.options].sort().join(',') !== 'O,X') return 'OX 선택지는 O와 X여야 합니다.'
  return null
}

/** 저장 전 검증. 고칠 곳을 화면 위쪽부터 모두 돌려준다(칸마다 하나, 문항 칸은 문항마다). */
export function validateDraftAll(draft: EditorDraft): DraftError[] {
  const errors: DraftError[] = []
  if (!draft.name.trim() || draft.name.length > 50) errors.push({ field: 'name', message: '세트 이름은 1~50자로 입력해 주세요.' })
  // textarea와 같은 UTF-16 길이로 전송할 원문(공백 포함)을 검증한다.
  if (draft.description.length > 1000) errors.push({ field: 'description', message: '세트 설명은 1000자 이하로 입력해 주세요.' })
  for (const question of draft.questions) {
    const at = (field: DraftField, message: string) => errors.push({ field, message, questionId: question.id })
    if (!Number.isInteger(question.seconds) || question.seconds < 10 || question.seconds > 300) at('seconds', '제한시간은 10~300초 사이의 정수로 입력해 주세요.')
    if (!question.prompt.trim() || question.prompt.length > 500) at('prompt', '문제 내용은 1~500자로 입력해 주세요.')
    const options = optionsMessage(question)
    if (options) at('options', options)
  }
  return errors
}

/** 저장 전 검증 중 화면 위쪽부터 첫 번째 문제. 없으면 null. */
export function validateDraft(draft: EditorDraft): DraftError | null {
  return validateDraftAll(draft)[0] ?? null
}
