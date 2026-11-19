import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toApiError } from '../../auth/api'
import { useAuth } from '../../auth/AuthProvider'
import { useProfessorQuiz } from '../../quiz/hooks/useProfessorQuiz'
import { closeRoom, createRoom as requestCreateRoom, unpinMessage } from '../../room/api'
import type { RoomSummaryResponse } from '../../room/room.types'
import { noRoom } from '../dashboard-data'
import type { Room } from '../dashboard-types'
import { readRoomId, writeRoomId } from '../roomStorage'

/** 교수의 수업 선택·개설·종료와 서버 퀴즈 상태를 연결한다. */
export function useProfessorDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [room, setRoom] = useState<Room>(() => {
    const id = readRoomId(user?.id)
    return id === null ? noRoom : { ...noRoom, id, active: true }
  })
  const [ending, setEnding] = useState(false)
  const [endPending, setEndPending] = useState(false)
  const [endError, setEndError] = useState('')
  const endInFlight = useRef(false)
  const createGeneration = useRef(0)
  const [feedback, setFeedback] = useState('')
  const professorQuiz = useProfessorQuiz(room.active ? room.id : null, setFeedback)
  const snapshot = professorQuiz.snapshot?.room.id === room.id ? professorQuiz.snapshot : null
  const displayRoom = snapshot ? { ...room, name: snapshot.room.title, code: snapshot.room.joinCode,
    joinUrl: snapshot.room.joinUrl, participants: professorQuiz.onlineCount } : room

  useEffect(() => { writeRoomId(user?.id, room.id) }, [user?.id, room.id])

  // 화면을 떠난 뒤 도착한 개설 응답은 현재 수업 선택을 바꾸지 않는다.
  useEffect(() => () => { createGeneration.current++ }, [location.key])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(''), 5000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const unpin = (messageId: number) => {
    if (room.id === null) return
    unpinMessage(room.id, messageId).catch((error) => setFeedback(toApiError(error).message))
  }

  /** 실패하면 오류를 그대로 던져 개설 화면이 안내한다. */
  const createRoom = async (title: string) => {
    const generation = ++createGeneration.current
    const created = await requestCreateRoom(title)
    if (generation !== createGeneration.current) return
    setRoom({
      id: created.id,
      name: created.title,
      code: created.joinCode,
      joinUrl: created.joinUrl,
      participants: 0,
      active: true,
    })
  }

  const openRoom = (summary: RoomSummaryResponse) => {
    createGeneration.current++
    setRoom({
      id: summary.id,
      name: summary.title,
      code: summary.joinCode,
      joinUrl: null,
      participants: summary.onlineCount,
      active: true,
    })
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

  const dismissRoom = () => {
    setRoom(noRoom)
    setEnding(false)
    setEndError('')
    navigate('/professor', { replace: true })
  }

  return {
    room: displayRoom,
    roomLoading: room.id !== null && !snapshot && !professorQuiz.error && !professorQuiz.ended,
    roomEnded: professorQuiz.ended,
    roomError: professorQuiz.error,
    dismissRoom,
    chat: professorQuiz.chat,
    reactions: professorQuiz.reactions,
    reactionStats: professorQuiz.reactionStats,
    notices: snapshot ? professorQuiz.pinned : [],
    unpin,
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
    realtimeNotice: professorQuiz.realtimeNotice,
    editorKey: location.pathname,
    createRoom,
    openRoom,
    endRoom,
  }
}
