import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfessorQuiz } from '../../quiz/hooks/useProfessorQuiz'
import { demoMessages, demoNotice, demoRoom } from '../dashboard-data'
import type { Room, ChatMessage } from '../dashboard-types'

/** Owns the professor prototype state across its child routes. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [room, setRoom] = useState<Room>(demoRoom)
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages)
  const [notice, setNotice] = useState(demoNotice)
  const [ending, setEnding] = useState(false)
  /** 퀴즈 시작·중단 실패처럼 화면 아래에 5초 동안 보여 줄 안내. */
  const [feedback, setFeedback] = useState('')
  const professorQuiz = useProfessorQuiz(
    room.active && room.id !== undefined ? room.id : null,
    setFeedback,
  )
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(''), 5000)
    return () => window.clearTimeout(timer)
  }, [feedback])
  const sendMessage = (text: string, reply?: string) =>
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), author: '강현민 교수', professor: true, text, reply },
    ])
  const createRoom = (name: string) => {
    setRoom({ name, code: demoRoom.code, participants: 0, active: true })
    setMessages([])
    setNotice(demoNotice)
  }
  const endRoom = () => {
    setRoom({ ...room, active: false })
    setEnding(false)
    navigate('/professor')
  }
  return {
    room,
    messages,
    notice,
    setNotice,
    quiz: professorQuiz.quiz,
    quizReady: professorQuiz.ready,
    loadStartableQuestionSets: professorQuiz.loadQuestionSets,
    startQuiz: professorQuiz.start,
    stopQuiz: professorQuiz.stop,
    closeResults: professorQuiz.closeResults,
    ending,
    setEnding,
    feedback,
    editorKey: location.pathname,
    createRoom,
    sendMessage,
    endRoom,
  }
}
