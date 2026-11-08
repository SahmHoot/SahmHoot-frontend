import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toApiError } from '../../auth/api'
import { closeRoom, createRoom as requestCreateRoom } from '../../room/api'
import type { RoomSummaryResponse } from '../../room/room.types'
import { demoMessages, demoNotice, noRoom } from '../dashboard-data'
import type { Room, QuestionSet, ChatMessage, QuizState } from '../dashboard-types'
import { initialQuiz } from '../dashboard-quiz'
import { loadQuestionSets, storageKey } from '../dashboard-storage'

/** Owns the professor prototype state across its child routes. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [room, setRoom] = useState<Room>(noRoom)
  const [sets, setSets] = useState<QuestionSet[]>(loadQuestionSets)
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages)
  const [notice, setNotice] = useState(demoNotice)
  const [quiz, setQuiz] = useState<QuizState>(initialQuiz)
  const [ending, setEnding] = useState(false)
  const [endPending, setEndPending] = useState(false)
  const [endError, setEndError] = useState('')
  const [feedback, setFeedback] = useState('')
  const quizRoute =
    location.pathname === '/professor/room' || location.pathname === '/professor/room/'
  useEffect(() => {
    if (!quizRoute || (quiz.phase !== 'running' && quiz.phase !== 'between') || !quiz.set) return
    const timer = window.setTimeout(
      () =>
        setQuiz((current) => {
          if (!current.set) return initialQuiz
          if (current.remaining > 1) return { ...current, remaining: current.remaining - 1 }
          if (current.phase === 'running')
            return current.index === current.set.questions.length - 1
              ? { ...current, phase: 'results', remaining: 0 }
              : { ...current, phase: 'between', remaining: 3 }
          return {
            ...current,
            phase: 'running',
            index: current.index + 1,
            remaining: current.set.seconds,
          }
        }),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [quiz, quizRoute])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(''), 5000)
    return () => window.clearTimeout(timer)
  }, [feedback])
  const saveSets = (next: QuestionSet[]) => {
    setSets(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      return true
    } catch {
      setFeedback('브라우저에 저장하지 못했습니다. 변경 내용은 현재 화면에서만 유지됩니다.')
      return false
    }
  }
  const sendMessage = (text: string, reply?: string) =>
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), author: '강현민 교수', professor: true, text, reply },
    ])
  /** 서버에 방을 만든다. 실패하면 오류를 그대로 던져 개설 화면이 안내한다. */
  const createRoom = async (title: string) => {
    const created = await requestCreateRoom(title)
    setRoom({
      id: created.id,
      name: created.title,
      code: created.joinCode,
      joinUrl: created.joinUrl,
      participants: 0,
      active: true,
    })
    setQuiz(initialQuiz)
    setMessages([])
    setNotice(demoNotice)
  }
  const openRoom = (summary: RoomSummaryResponse) => {
    setRoom({
      id: summary.id,
      name: summary.title,
      code: summary.joinCode,
      joinUrl: null,
      participants: summary.onlineCount,
      active: true,
    })
    setQuiz(initialQuiz)
    navigate('/professor/room')
  }
  const deleteSet = (id: string) => saveSets(sets.filter((set) => set.id !== id))
  const saveSet = (set: QuestionSet) => {
    const next = sets.some((item) => item.id === set.id)
      ? sets.map((item) => (item.id === set.id ? set : item))
      : [...sets, set]
    if (saveSets(next)) setFeedback('문제 세트를 이 브라우저에 저장했습니다.')
  }
  const closeResults = () => {
    setQuiz(initialQuiz)
    navigate('/professor/room')
  }
  const cancelEnding = () => {
    if (endPending) return
    setEnding(false)
    setEndError('')
  }
  const endRoom = async () => {
    if (endPending) return
    if (room.id !== null) {
      setEndPending(true)
      setEndError('')
      try {
        await closeRoom(room.id)
      } catch (error) {
        setEndError(toApiError(error).message)
        return
      } finally {
        setEndPending(false)
      }
    }
    setRoom(noRoom)
    setQuiz(initialQuiz)
    setEnding(false)
    navigate('/professor')
  }
  return {
    room,
    sets,
    messages,
    notice,
    setNotice,
    quiz,
    setQuiz,
    ending,
    setEnding,
    endPending,
    endError,
    cancelEnding,
    feedback,
    editorKey: location.pathname,
    createRoom,
    openRoom,
    deleteSet,
    saveSet,
    sendMessage,
    closeResults,
    endRoom,
  }
}
