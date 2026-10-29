import { useEffect, useReducer, useState } from 'react'
import { initialMessages, roomQuiz } from '../data/studentFixtures'
import { saveAnswers } from '../data/studentStorage'
import type { ChatMessage, FloatingReaction, Reaction, RoomPhase, RoomPreview } from '../types/student.types'

interface RoomState {
  phase: RoomPhase
  index: number
  answers: (number | null)[]
  submitted: boolean
  deadline: number | null
  secondsLeft: number
}

type Action =
  | { type: 'tick'; now: number }
  | { type: 'select'; answer: number; now: number }
  | { type: 'submit'; now: number }

function initialState(preview: RoomPreview): RoomState {
  const answers: (number | null)[] = roomQuiz.questions.map(() => null)
  if (preview === 'results') return { phase: 'results', index: 2, answers: [0, 1, 0, null, 2], submitted: true, deadline: null, secondsLeft: 0 }
  if (preview === 'question') return { phase: 'question', index: 2, answers, submitted: false, deadline: Date.now() + 15000, secondsLeft: 15 }
  return { phase: 'waiting', index: 0, answers, submitted: false, deadline: preview === 'waiting' ? null : Date.now() + 12000, secondsLeft: 0 }
}

function reducer(state: RoomState, action: Action): RoomState {
  if (action.type === 'select') {
    if (state.phase !== 'question' || state.submitted || (state.deadline !== null && action.now >= state.deadline)) return state
    return { ...state, answers: state.answers.map((answer, index) => index === state.index ? action.answer : answer) }
  }
  if (action.type === 'submit') {
    if (state.phase !== 'question' || state.answers[state.index] === null || state.submitted || (state.deadline !== null && action.now >= state.deadline)) return state
    return { ...state, submitted: true }
  }
  if (state.deadline === null) return state
  const remaining = Math.max(0, Math.ceil((state.deadline - action.now) / 1000))
  if (remaining > 0) return state.phase === 'question' && remaining !== state.secondsLeft ? { ...state, secondsLeft: remaining } : state
  if (state.phase === 'waiting') {
    const duration = roomQuiz.questions[0].duration
    return { ...state, phase: 'question', deadline: action.now + duration * 1000, secondsLeft: duration }
  }
  if (state.phase === 'question') return { ...state, phase: 'closing', submitted: true, secondsLeft: 0, deadline: action.now + 1000 }
  if (state.phase === 'closing') return { ...state, phase: 'feedback', deadline: action.now + 3000 }
  if (state.phase === 'feedback') {
    const index = state.index + 1
    if (index === roomQuiz.questions.length) return { ...state, phase: 'results', deadline: null }
    const duration = roomQuiz.questions[index].duration
    return { ...state, index, phase: 'question', submitted: false, deadline: action.now + duration * 1000, secondsLeft: duration }
  }
  return state
}

export default function useStudentRoom(nickname: string, preview: RoomPreview) {
  const [state, dispatch] = useReducer(reducer, preview, initialState)
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(nickname))
  const [reactions, setReactions] = useState<FloatingReaction[]>([])

  useEffect(() => {
    if (state.deadline === null) return
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 200)
    return () => window.clearInterval(timer)
  }, [state.deadline])

  useEffect(() => {
    if (state.phase === 'results' && preview !== 'results') saveAnswers(roomQuiz.id, state.answers)
  }, [state.phase, state.answers, preview])

  useEffect(() => {
    if (reactions.length === 0) return
    const timer = window.setInterval(() => {
      const now = Date.now()
      setReactions(previous => previous.some(reaction => reaction.expiresAt <= now)
        ? previous.filter(reaction => reaction.expiresAt > now) : previous)
    }, 100)
    return () => window.clearInterval(timer)
  }, [reactions.length])

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 500) return
    setMessages(previous => [...previous, { id: crypto.randomUUID(), nickname, role: 'student', mine: true, text: trimmed }])
  }

  return {
    ...state,
    question: roomQuiz.questions[state.index],
    messages,
    reactions,
    sendMessage,
    selectAnswer: (answer: number) => dispatch({ type: 'select', answer, now: Date.now() }),
    submitAnswer: () => dispatch({ type: 'submit', now: Date.now() }),
    sendReaction: (emoji: Reaction) => setReactions(previous => [...previous.slice(-11), { id: crypto.randomUUID(), emoji, expiresAt: Date.now() + 1800 }]),
  }
}
