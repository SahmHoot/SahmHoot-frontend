import { Navigate, useLocation, useParams } from 'react-router-dom'
import { readSession } from '../data/studentStorage'
import type { StudentSession } from '../types/student.types'
import LiveStudentRoom from './LiveStudentRoom'

export default function StudentRoom() {
  const { code = '' } = useParams()
  const location = useLocation()
  const session = (location.state as StudentSession | null) ?? readSession()
  // 입장 API를 거치지 않은 세션(roomId 없음)은 수업을 열 수 없으므로 입장 화면에서 다시 들어온다.
  if (!/^\d{6}$/.test(code) || !session || session.code !== code || !session.roomId) {
    return <Navigate to={/^\d{6}$/.test(code) ? `/student/join/${code}` : '/student'} replace />
  }
  return <LiveStudentRoom key={session.roomId} roomId={session.roomId} />
}
