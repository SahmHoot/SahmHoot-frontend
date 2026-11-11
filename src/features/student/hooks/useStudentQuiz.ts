import { useEffect, useReducer, useState } from 'react'
import { fetchRoomState } from '../../../shared/api/roomState'
import { onStompErrorMessage, publish } from '../../../shared/stomp'
import { useClassroom } from '../../room/useClassroom'
import { initialStudentAnswers, myAnswer, studentAnswersReducer } from '../studentAnswers'

/** 참가자 수업 화면: 공통 수업 동기화에 내 답 제출·복원과 공개된 정답을 더한다(06 2절 답 제출). */
export function useStudentQuiz(roomId: number) {
  const [answers, dispatch] = useReducer(studentAnswersReducer, initialStudentAnswers)
  const classroom = useClassroom(roomId, false, dispatch)
  /** 연결이 끊겨 답을 보내지 못한 문항. 안내 문구는 그 문항에서만 보인다. */
  const [unsentQuestionId, setUnsentQuestionId] = useState<number | null>(null)
  const { quiz } = classroom
  const currentQuestionId = quiz.phase === 'question' || quiz.phase === 'between' ? quiz.runQuestionId : null

  // shortcut: ERROR에 어느 요청인지 담겨 있지 않아 QUESTION_CLOSED만 답 거부로 보고, 어느 문항인지는 서버 시각으로 가른다(studentAnswers).
  // 백엔드 ERROR에 runQuestionId가 생기면 그 값을 쓰고, 학생 채팅·반응을 보내게 되면 다른 거부 코드도 다시 본다.
  useEffect(() => onStompErrorMessage((error) => {
    if (error.code === 'QUESTION_CLOSED') dispatch({ kind: 'rejected', sentAt: error.sentAt })
  }), [])

  // 늦게 온 state보다 최근에 고른 답을 서버에 다시 보낸다(studentAnswers의 snapshot). 못 보내면 다음 재연결 state에서 다시 정한다.
  // 그사이 마감된 문항에는 보내지 않는다. 마감 뒤에는 verify로 서버 답을 맞춘다.
  const { resend, open, verify } = answers
  useEffect(() => {
    if (resend && open?.runQuestionId === resend.runQuestionId) publish(`/app/rooms/${roomId}/answer`, resend)
  }, [resend, open, roomId])

  useEffect(() => {
    if (verify === null) return
    const controller = new AbortController()
    // shortcut: 조회가 실패하면 다시 묻지 않고, 다음 재연결 state(마감 뒤라 서버 답이 확정됨)가 바로잡는다.
    fetchRoomState(roomId, controller.signal).then((state) => dispatch({ kind: 'verified', runQuestionId: verify,
      choiceId: state.quiz?.myAnswers?.find((answer) => answer.runQuestionId === verify)?.choiceId ?? null }), () => {})
    return () => controller.abort()
  }, [verify, roomId])

  /** 답을 고르면 바로 보낸다. 같은 문항에 다시 보내면 서버가 답을 바꾼다. */
  function select(choiceId: number) {
    if (quiz.phase !== 'question') return
    const runQuestionId = quiz.runQuestionId
    if (myAnswer(answers, runQuestionId) === choiceId) return
    if (!publish(`/app/rooms/${roomId}/answer`, { runQuestionId, choiceId })) {
      setUnsentQuestionId(runQuestionId)
      return
    }
    dispatch({ kind: 'select', runQuestionId, choiceId })
    setUnsentQuestionId(null)
  }

  const notice = currentQuestionId === null ? null
    : answers.rejectedQuestionId === currentQuestionId ? '마감된 뒤에 고른 답은 반영되지 않았습니다.'
      : unsentQuestionId === currentQuestionId ? '연결이 끊겨 답을 보내지 못했습니다. 다시 연결되면 다시 골라 주세요.' : null

  return {
    ...classroom,
    answerOf: (runQuestionId: number) => myAnswer(answers, runQuestionId),
    correctOf: (runQuestionId: number): number | null => answers.correct[runQuestionId] ?? null,
    notice,
    select,
  }
}
