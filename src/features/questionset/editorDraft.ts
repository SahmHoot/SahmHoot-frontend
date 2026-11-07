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

export function validateDraft(draft: EditorDraft): { message: string; questionId?: string } | null {
  if (!draft.name.trim() || draft.name.length > 50) return { message: '세트 이름은 1~50자로 입력해 주세요.' }
  for (const [index, question] of draft.questions.entries()) {
    let message = ''
    if (!question.prompt.trim() || question.prompt.length > 500) message = '문제 내용은 1~500자로 입력해 주세요.'
    else if (!Number.isInteger(question.seconds) || question.seconds < 10 || question.seconds > 300) message = '제한시간은 10~300초 사이의 정수로 입력해 주세요.'
    else if (question.options.length !== (question.type === 'ox' ? 2 : 4)
      || question.options.some((option) => !option.trim() || option.length > 200)) message = '선택지 개수와 내용을 확인해 주세요. 선택지는 1~200자입니다.'
    else if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length) message = '정답을 정확히 하나 선택해 주세요.'
    else if (question.type === 'ox' && [...question.options].sort().join(',') !== 'O,X') message = 'OX 선택지는 O와 X여야 합니다.'
    if (message) return { message: `${index + 1}번 문항: ${message}`, questionId: question.id }
  }
  return null
}
