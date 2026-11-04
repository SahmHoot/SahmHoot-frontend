import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfessorQuiz } from '../../quiz/hooks/useProfessorQuiz'
import { demoMessages, demoNotice, demoRoom } from '../dashboard-data'
import type { Room, QuestionSet, ChatMessage } from '../dashboard-types'
import { loadQuestionSets, storageKey } from '../dashboard-storage'

/** Owns the professor prototype state across its child routes. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [room, setRoom] = useState<Room>(demoRoom)
  const [sets, setSets] = useState<QuestionSet[]>(loadQuestionSets)
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages)
  const [notice, setNotice] = useState(demoNotice)
  const [ending, setEnding] = useState(false)
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
    setMessages([])
    setNotice(demoNotice)
  }
  const deleteSet = (id: string) => saveSets(sets.filter((set) => set.id !== id))
  const saveSet = (set: QuestionSet) => {
    const next = sets.some((item) => item.id === set.id)
      ? sets.map((item) => (item.id === set.id ? set : item))
      : [...sets, set]
    if (saveSets(next)) setFeedback('문제 세트를 이 브라우저에 저장했습니다.')
  }
  const endRoom = () => {
    setRoom({ ...room, active: false })
    setEnding(false)
    navigate('/professor')
  }
  return {
    room,
    sets,
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
    deleteSet,
    saveSet,
    sendMessage,
    endRoom,
  }
}
