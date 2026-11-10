import type { ProfessorQuizAction } from '../quiz/professorQuizReducer'

/**
 * 학생 화면의 내 답과 공개된 정답. 교수 화면 상태(professorQuizReducer)와 따로 두어
 * 교수 화면에 정답이 섞이지 않게 한다(QZ-05). 같은 snapshot·message 동작을 받아 함께 갱신한다.
 */
export interface StudentAnswers {
  runId: number | null
  /** 문항(runQuestionId)별로 보낸 선택지 ID 순서. 마지막 값이 화면에 보이는 내 답이다. */
  sent: Record<number, number[]>
  /** 마감으로 공개된 정답 선택지 ID. */
  correct: Record<number, number>
  /** 마지막으로 답을 보낸 문항. 서버가 거부하면 이 문항의 답을 하나씩 되돌린다. */
  lastSentQuestionId: number | null
}

export type StudentAnswerAction =
  | ProfessorQuizAction
  | { kind: 'select'; runQuestionId: number; choiceId: number }
  /** 서버가 마지막으로 보낸 답을 거부했다(마감 뒤 도착 등). */
  | { kind: 'rejected' }

export const initialStudentAnswers: StudentAnswers = { runId: null, sent: {}, correct: {}, lastSentQuestionId: null }

/** 화면에 보일 내 답. 고르지 않았으면 null. */
export function myAnswer(state: StudentAnswers, runQuestionId: number): number | null {
  const history = state.sent[runQuestionId]
  return history && history.length > 0 ? history[history.length - 1] : null
}

export function studentAnswersReducer(state: StudentAnswers, action: StudentAnswerAction): StudentAnswers {
  switch (action.kind) {
    case 'reset':
      return initialStudentAnswers

    case 'select': {
      const history = state.sent[action.runQuestionId] ?? []
      return { ...state, sent: { ...state.sent, [action.runQuestionId]: [...history, action.choiceId] },
        lastSentQuestionId: action.runQuestionId }
    }

    case 'rejected': {
      // 마감 뒤에 보낸 답은 모두 거부되고 그 답들이 가장 나중에 보낸 것이므로, 끝에서 하나씩 지우면 서버에 남은 답이 된다.
      const id = state.lastSentQuestionId
      const history = id === null ? undefined : state.sent[id]
      if (id === null || !history || history.length === 0) return state
      return { ...state, sent: { ...state.sent, [id]: history.slice(0, -1) } }
    }

    case 'snapshot': {
      // 새로고침·재연결 때는 서버에 저장된 내 답이 기준이다.
      const { quiz } = action.snapshot
      if (!quiz) return initialStudentAnswers
      const sent: Record<number, number[]> = {}
      for (const answer of quiz.myAnswers ?? []) sent[answer.runQuestionId] = [answer.choiceId]
      const question = quiz.currentQuestion
      const correct: Record<number, number> = {}
      if (question && question.correctChoiceId !== null) correct[question.runQuestionId] = question.correctChoiceId
      return { runId: quiz.runId, sent, correct, lastSentQuestionId: null }
    }

    case 'message': {
      const { message } = action
      switch (message.type) {
        case 'QUESTION_OPENED':
          if (state.runId !== null && message.runId < state.runId) return state
          return message.runId === state.runId ? state : { ...initialStudentAnswers, runId: message.runId }
        case 'QUESTION_CLOSED':
          return { ...state, correct: { ...state.correct, [message.runQuestionId]: message.correctChoiceId } }
        case 'QUIZ_CANCELED':
          return message.runId === state.runId ? initialStudentAnswers : state
        case 'ROOM_WAITING':
          return initialStudentAnswers
        default:
          return state
      }
    }
  }
}
