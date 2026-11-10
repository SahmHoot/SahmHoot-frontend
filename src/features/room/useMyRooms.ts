import { useEffect, useState } from 'react'
import { toApiError } from '../auth/api'
import { fetchMyRooms } from './api'
import type { RoomSummaryResponse } from './room.types'

export type MyRoomsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; rooms: RoomSummaryResponse[] }

/** 교수 홈의 진행 중 수업 목록. 화면에 들어올 때마다 서버에서 다시 읽는다. */
export function useMyRooms() {
  const [state, setState] = useState<MyRoomsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetchMyRooms()
      .then((rooms) => {
        if (active) setState({ status: 'ready', rooms })
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: toApiError(error).message })
      })
    return () => {
      active = false
    }
  }, [attempt])
  const reload = () => {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }
  return { state, reload }
}
