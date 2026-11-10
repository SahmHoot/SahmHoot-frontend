import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toApiError } from '../../auth/api'
import { getRoomByCode, joinRoom } from '../api'
import { writeSession } from '../data/studentStorage'
import type { RoomByCodeResponse } from '../types/student.types'

const nicknames = ['조용한 판다몽', '부지런한 수박', '느긋한 참외', '용감한 자두', '행복한 고양이', '씩씩한 복숭아']
const unavailableMessage = '존재하지 않거나 종료된 수업입니다. 코드를 확인하거나 홈으로 돌아가 주세요.'

export function useStudentJoin(qrCode: string) {
  const navigate = useNavigate()
  const [code, setCode] = useState(qrCode)
  const [nickname, setNickname] = useState(nicknames[0])
  const [room, setRoom] = useState<RoomByCodeResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const inFlight = useRef(false)

  const open = useCallback((entryCode: string, found: RoomByCodeResponse, name: string) => {
    const session = { code: entryCode, nickname: name, roomId: found.roomId, title: found.title }
    writeSession(session)
    navigate(`/student/room/${entryCode}`, { state: session, replace: true })
  }, [navigate])

  const showError = useCallback((failure: unknown) => {
    const apiError = toApiError(failure)
    switch (apiError.code) {
      case 'ROOM_NOT_FOUND':
      case 'ROOM_CLOSED':
        setRoom(null)
        setError(unavailableMessage)
        break
      case 'NICKNAME_ALREADY_USED': setError('이미 사용 중인 닉네임입니다. 다른 이름을 입력해 주세요.'); break
      case 'NICKNAME_NOT_ALLOWED': setError('한글·영문·숫자·공백만 사용할 수 있으며 ‘교수’는 포함할 수 없습니다.'); break
      case 'RATE_LIMITED': setError('입장 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'); break
      default: setError(apiError.fieldErrors?.[0]?.message ?? apiError.message)
    }
  }, [])

  const lookup = useCallback(async (entryCode: string) => {
    if (inFlight.current) return
    if (!/^\d{6}$/.test(entryCode)) { setError('입장 코드를 숫자 6자리로 입력해 주세요.'); return }
    const request = ++generation.current
    inFlight.current = true
    setPending(true)
    setError('')
    try {
      const found = await getRoomByCode(entryCode)
      if (request !== generation.current) return
      if (found.status === 'CLOSED') { setRoom(null); setError(unavailableMessage); return }
      if (found.isOwner) { navigate('/professor', { replace: true }); return }
      if (found.joined && found.myNickname) { open(entryCode, found, found.myNickname); return }
      setRoom(found)
      setNickname(found.myNickname ?? nicknames[Math.floor(Math.random() * nicknames.length)])
    } catch (failure) {
      if (request === generation.current) showError(failure)
    } finally {
      if (request === generation.current) { inFlight.current = false; setPending(false) }
    }
  }, [navigate, open, showError])

  useEffect(() => {
    if (qrCode) void lookup(qrCode)
    return () => { generation.current += 1; inFlight.current = false }
  }, [qrCode, lookup])

  const enter = async () => {
    if (inFlight.current) return
    if (!room) { await lookup(code); return }
    const name = nickname.normalize('NFC').trim()
    if (name.length < 2 || name.length > 10) { setError('닉네임은 2~10자로 입력해 주세요.'); return }
    if (name.includes('교수') || !/^[가-힣a-zA-Z0-9 ]+$/.test(name)) {
      setError('한글·영문·숫자·공백만 사용할 수 있으며 ‘교수’는 포함할 수 없습니다.')
      return
    }
    const request = ++generation.current
    inFlight.current = true
    setPending(true)
    setError('')
    try {
      const joined = await joinRoom(code, name)
      if (request === generation.current) open(code, { ...room, roomId: joined.roomId }, joined.nickname)
    } catch (failure) {
      if (request === generation.current) showError(failure)
    } finally {
      if (request === generation.current) { inFlight.current = false; setPending(false) }
    }
  }

  const randomizeNickname = () => {
    const choices = nicknames.filter((value) => value !== nickname)
    setNickname(choices[Math.floor(Math.random() * choices.length)])
    setError('')
  }
  return { code, setCode, nickname, setNickname, room, pending, error, setError, enter, randomizeNickname }
}
