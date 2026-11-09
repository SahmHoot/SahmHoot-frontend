import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toApiError } from '../../auth/api'
import { useProfessorQuiz } from '../../quiz/hooks/useProfessorQuiz'
import { closeRoom, createRoom as requestCreateRoom } from '../../room/api'
import type { RoomSummaryResponse } from '../../room/room.types'
import { demoMessages, demoNotice, noRoom } from '../dashboard-data'
import type { Room, ChatMessage } from '../dashboard-types'

/** 교수의 수업 선택·개설·종료와 서버 퀴즈 상태를 연결한다. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [room, setRoom] = useState<Room>(noRoom)
  const [messages, setMessages] = useState<ChatMessage[]>(demoMessages)
  const [notice, setNotice] = useState(demoNotice)
  const [ending, setEnding] = useState(false)
  const [endPending, setEndPending] = useState(false)
  const [endError, setEndError] = useState('')
  const endInFlight = useRef(false)
  const [feedback, setFeedback] = useState('')
  const professorQuiz = useProfessorQuiz(room.active ? room.id : null, setFeedback)

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

  /** 실패하면 오류를 그대로 던져 개설 화면이 안내한다. */
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
    setMessages([])
    setNotice(demoNotice)
    navigate('/professor/room')
  }

  const cancelEnding = () => {
    if (endInFlight.current) return
    setEnding(false)
    setEndError('')
  }

  const endRoom = async () => {
    if (endInFlight.current || room.id === null) return
    endInFlight.current = true
    setEndPending(true)
    setEndError('')
    try {
      await closeRoom(room.id)
      setRoom(noRoom)
      setEnding(false)
      navigate('/professor')
    } catch (error) {
      setEndError(toApiError(error).message)
    } finally {
      endInFlight.current = false
      setEndPending(false)
    }
  }

  return {
    room,
    messages,
    notice,
    setNotice,
    quiz: professorQuiz.quiz,
    quizReady: professorQuiz.ready,
    startQuiz: professorQuiz.start,
    stopQuiz: professorQuiz.stop,
    closeResults: professorQuiz.closeResults,
    ending,
    setEnding,
    endPending,
    endError,
    cancelEnding,
    feedback,
    editorKey: location.pathname,
    createRoom,
    openRoom,
    sendMessage,
    endRoom,
  }
}
