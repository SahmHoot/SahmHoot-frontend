import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { demoMessages, demoRoom } from '../dashboard-data'
import type { Room, QuestionSet, ChatMessage, QuizState } from '../dashboard-types'
import { initialQuiz } from '../dashboard-quiz'
import { loadQuestionSets, storageKey } from '../dashboard-storage'

/** Owns the professor prototype state across its child routes. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [room, setRoom] = useState<Room>(demoRoom)
  const [sets, setSets] = useState<QuestionSet[]>(loadQuestionSets)
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages)
  const [quiz, setQuiz] = useState<QuizState>(initialQuiz)
  const [ending, setEnding] = useState(false)
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
  const createRoom = (name: string) => {
    setRoom({ name, code: demoRoom.code, participants: 0, active: true })
    setQuiz(initialQuiz)
    setMessages([])
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
  const endRoom = () => {
    setRoom({ ...room, active: false })
    setQuiz(initialQuiz)
    setEnding(false)
    navigate('/professor')
  }
  return {
    room,
    sets,
    messages,
    quiz,
    setQuiz,
    ending,
    setEnding,
    feedback,
    editorKey: location.pathname,
    createRoom,
    deleteSet,
    saveSet,
    sendMessage,
    closeResults,
    endRoom,
  }
}
