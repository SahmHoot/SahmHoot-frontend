import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { demoMessages, demoNotice, demoRoom } from '../dashboard-data'
import type { Room, ChatMessage, QuizState } from '../dashboard-types'
import { advanceQuiz, initialQuiz } from '../dashboard-quiz'

/** Owns the professor prototype state across its child routes. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [room, setRoom] = useState<Room>(demoRoom)
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages)
  const [notice, setNotice] = useState(demoNotice)
  const [quiz, setQuiz] = useState<QuizState>(initialQuiz)
  const [ending, setEnding] = useState(false)
  const quizRoute =
    location.pathname === '/professor/room' || location.pathname === '/professor/room/'
  useEffect(() => {
    if (!quizRoute || (quiz.phase !== 'running' && quiz.phase !== 'between') || !quiz.set) return
    const timer = window.setTimeout(
      () => setQuiz(advanceQuiz),
      1000,
    )
    return () => window.clearTimeout(timer)
  }, [quiz, quizRoute])
  const sendMessage = (text: string, reply?: string) =>
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), author: '강현민 교수', professor: true, text, reply },
    ])
  const createRoom = (name: string) => {
    setRoom({ name, code: demoRoom.code, participants: 0, active: true })
    setQuiz(initialQuiz)
    setMessages([])
    setNotice(demoNotice)
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
    messages,
    notice,
    setNotice,
    quiz,
    setQuiz,
    ending,
    setEnding,
    editorKey: location.pathname,
    createRoom,
    sendMessage,
    closeResults,
    endRoom,
  }
}
