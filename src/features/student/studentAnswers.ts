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
  /** 문항별로 마지막 state 뒤에 보내 서버 반영을 아직 확인하지 못한 답의 수. 거부는 이 답만 되돌린다. */
  pending: Record<number, number>
  /** 지금 열려 있는 문항. 거부가 어느 문항의 것인지 가를 때 쓴다. */
  open: { runQuestionId: number; closesAt: string } | null
  /** 마지막으로 답이 거부된 문항. 안내 문구를 그 문항에만 보인다. */
  rejectedQuestionId: number | null
  /** state가 그 뒤에 고른 답보다 오래돼 서버에 다시 보낼 답. state를 받을 때마다 새로 정한다. */
  resend: { runQuestionId: number; choiceId: number } | null
}

export type StudentAnswerAction =
  | ProfessorQuizAction
  | { kind: 'select'; runQuestionId: number; choiceId: number }
  /** 서버가 보낸 답 하나를 거부했다(ERROR QUESTION_CLOSED). sentAt은 거부한 서버 시각이다. */
  | { kind: 'rejected'; sentAt: string }

export const initialStudentAnswers: StudentAnswers = {
  runId: null, sent: {}, correct: {}, pending: {}, open: null, rejectedQuestionId: null, resend: null,
}

/** 화면에 보일 내 답. 고르지 않았으면 null. */
export function myAnswer(state: StudentAnswers, runQuestionId: number): number | null {
  const history = state.sent[runQuestionId]
  return history && history.length > 0 ? history[history.length - 1] : null
}

/**
 * 거부된 답의 문항을 고른다. 서버 ERROR에는 어느 요청인지 담겨 있지 않다.
 * 서버는 열린 문항의 답을 closesAt + 1초까지 받고, 조기 마감이면 QUESTION_CLOSED를 거부보다 먼저 보낸다(06 5절).
 * 그래서 열린 문항이 아직 받는 시각에 온 거부는 앞 문항에 늦게 도착한 답의 것이다.
 */
function rejectedQuestion(state: StudentAnswers, sentAt: string): number | null {
  const openId = state.open?.runQuestionId ?? null
  const accepting = state.open !== null && Date.parse(sentAt) <= Date.parse(state.open.closesAt) + 1000
  const candidates = Object.keys(state.pending).map(Number)
    .filter((id) => state.pending[id] > 0 && !(accepting && id === openId))
  if (openId !== null && candidates.includes(openId)) return openId
  return candidates.length > 0 ? Math.max(...candidates) : null
}

export function studentAnswersReducer(state: StudentAnswers, action: StudentAnswerAction): StudentAnswers {
  switch (action.kind) {
    case 'reset':
      return initialStudentAnswers

    case 'select': {
      const id = action.runQuestionId
      return { ...state, sent: { ...state.sent, [id]: [...(state.sent[id] ?? []), action.choiceId] },
        pending: { ...state.pending, [id]: (state.pending[id] ?? 0) + 1 },
        rejectedQuestionId: state.rejectedQuestionId === id ? null : state.rejectedQuestionId }
    }

    case 'rejected': {
      // 같은 문항에서 마감 뒤에 보낸 답은 모두 거부되고 가장 나중에 보낸 것이므로, 끝에서 하나씩 지우면 서버에 남은 답이 된다.
      const id = rejectedQuestion(state, action.sentAt)
      if (id === null) return state
      return { ...state, sent: { ...state.sent, [id]: state.sent[id].slice(0, -1) },
        pending: { ...state.pending, [id]: state.pending[id] - 1 }, rejectedQuestionId: id }
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
      const open = quiz.phase === 'QUESTION' && question ? { runQuestionId: question.runQuestionId, closesAt: question.closesAt } : null
      const pending: Record<number, number> = {}
      let resend: StudentAnswers['resend'] = null
      // 서버는 답을 받았다는 응답을 보내지 않아, state가 그 뒤에 보낸 답보다 먼저 만들어졌는지 알 수 없다
      // (재연결 직후 늦게 도착한 조회, 보내는 중이던 답, 끊긴 줄 모르고 보내 사라진 답). 아직 열린 문항이면
      // 마지막 state 뒤에 고른 내 답을 유지하고 다시 보내 서버와 맞춘다. 같은 답을 다시 보내도 서버 값은 같다. 마감된 문항은 서버 값이 맞다.
      // shortcut: 같은 학생이 다른 탭에서 그 사이 바꾼 답보다 이 탭의 답이 우선한다. 탭 간 충돌을 다루게 되면 다시 본다.
      const mine = open && quiz.runId === state.runId && state.pending[open.runQuestionId] ? myAnswer(state, open.runQuestionId) : null
      if (open && mine !== null && mine !== sent[open.runQuestionId]?.[0]) {
        // 다시 보낸 답이 거부되면(그새 마감) 서버 값으로 돌아가도록 서버 값 뒤에 쌓는다.
        sent[open.runQuestionId] = [...(sent[open.runQuestionId] ?? []), mine]
        pending[open.runQuestionId] = 1
        resend = { runQuestionId: open.runQuestionId, choiceId: mine }
      }
      return { runId: quiz.runId, sent, correct, pending, open, rejectedQuestionId: null, resend }
    }

    case 'message': {
      const { message } = action
      switch (message.type) {
        case 'QUESTION_OPENED': {
          if (state.runId !== null && message.runId < state.runId) return state
          const open = { runQuestionId: message.runQuestionId, closesAt: message.closesAt }
          if (message.runId !== state.runId) return { ...initialStudentAnswers, runId: message.runId, open }
          // 이미 마감된 문항이 다시 오면(재전송) 지난 메시지다.
          return message.runQuestionId in state.correct ? state : { ...state, open }
        }
        case 'QUESTION_CLOSED': {
          const id = message.runQuestionId
          // 그보다 앞 문항의 답은 이미 처리됐으므로, 늦은 거부를 받을 수 있는 건 방금 닫힌 문항뿐이다.
          return { ...state, correct: { ...state.correct, [id]: message.correctChoiceId },
            pending: state.pending[id] ? { [id]: state.pending[id] } : {},
            open: state.open?.runQuestionId === id ? null : state.open }
        }
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
