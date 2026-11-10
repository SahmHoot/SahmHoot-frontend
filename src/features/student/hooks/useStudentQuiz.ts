import { useEffect, useReducer, useState } from 'react'
import { onStompErrorMessage, publish } from '../../../shared/stomp'
import { useClassroom } from '../../room/useClassroom'
import { initialStudentAnswers, myAnswer, studentAnswersReducer } from '../studentAnswers'

/** 안내 문구는 그 문항에서만 보인다. */
interface Notice {
  runQuestionId: number
  text: string
}

/** 참가자 수업 화면: 공통 수업 동기화에 내 답 제출·복원과 공개된 정답을 더한다(06 2절 답 제출). */
export function useStudentQuiz(roomId: number) {
  const [answers, dispatch] = useReducer(studentAnswersReducer, initialStudentAnswers)
  const classroom = useClassroom(roomId, false, dispatch)
  const [notice, setNotice] = useState<Notice | null>(null)
  const { quiz } = classroom
  const currentQuestionId = quiz.phase === 'question' || quiz.phase === 'between' ? quiz.runQuestionId : null

  useEffect(() => onStompErrorMessage((error) => {
    // shortcut: 서버가 답 거부를 다른 거부와 구분해 주지 않아 QUESTION_CLOSED만 답 거부로 본다. 학생 채팅·반응을 보내게 되면 요청별 구분을 다시 본다.
    if (error.code !== 'QUESTION_CLOSED') return
    dispatch({ kind: 'rejected' })
    if (currentQuestionId !== null) setNotice({ runQuestionId: currentQuestionId, text: '마감된 뒤에 고른 답은 반영되지 않았습니다.' })
  }), [currentQuestionId])

  /** 답을 고르면 바로 보낸다. 같은 문항에 다시 보내면 서버가 답을 바꾼다. */
  function select(choiceId: number) {
    if (quiz.phase !== 'question') return
    const runQuestionId = quiz.runQuestionId
    if (myAnswer(answers, runQuestionId) === choiceId) return
    if (!publish(`/app/rooms/${roomId}/answer`, { runQuestionId, choiceId })) {
      setNotice({ runQuestionId, text: '연결이 끊겨 답을 보내지 못했습니다. 다시 연결되면 다시 골라 주세요.' })
      return
    }
    dispatch({ kind: 'select', runQuestionId, choiceId })
    setNotice(null)
  }

  return {
    ...classroom,
    answerOf: (runQuestionId: number) => myAnswer(answers, runQuestionId),
    correctOf: (runQuestionId: number): number | null => answers.correct[runQuestionId] ?? null,
    notice: notice !== null && notice.runQuestionId === currentQuestionId ? notice.text : null,
    select,
  }
}
