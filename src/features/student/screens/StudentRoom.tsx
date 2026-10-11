import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import hourglass from '../../../assets/student/hourglass.svg'
import StudentHeader from '../components/StudentHeader'
import StudentChat from '../components/StudentChat'
import StudentQuizQuestion from '../components/StudentQuizQuestion'
import StudentQuizResults from '../components/StudentQuizResults'
import useStudentRoom from '../hooks/useStudentRoom'
import { classTitle, roomQuiz } from '../data/studentFixtures'
import { readSession, writeSession } from '../data/studentStorage'
import type { RoomPreview, StudentSession } from '../types/student.types'
import './StudentRoom.css'

export default function StudentRoom() {
  const { code = '' } = useParams()
  const location = useLocation()
  const [search] = useSearchParams()
  const session = (location.state as StudentSession | null) ?? readSession()
  // Development-only deep links allow each Figma state to be reviewed independently.
  const view = import.meta.env.DEV ? search.get('view') : null
  const preview: RoomPreview = view === 'waiting' || view === 'question' || view === 'results' ? view : null
  if (!/^\d{6}$/.test(code) || !session || session.code !== code) {
    return <Navigate to={/^\d{6}$/.test(code) ? `/student/join/${code}` : '/student'} replace />
  }
  return <StudentRoomContent key={`${code}:${preview}`} session={session} preview={preview} />
}

function StudentRoomContent({ session, preview }: { session: StudentSession; preview: RoomPreview }) {
  const navigate = useNavigate()
  const room = useStudentRoom(session.nickname, preview)
  const waiting = room.phase === 'waiting'

  function leave() {
    writeSession(null)
    navigate('/student', { replace: true })
  }

  return (
    <div className="student-app">
      <StudentHeader title={classTitle} nickname={session.nickname} onLeave={leave} />
      <main className={`student-room ${waiting ? 'student-room--waiting' : ''}`}>
        {waiting ? (
          <div className="student-room__waiting-banner"><p><img src={hourglass} alt="" /><strong>대기 중</strong><span>· 교수님이 문제를 내면 이 자리에 문제가 나타나고 채팅은 오른쪽으로 이동합니다</span></p><span className="student-muted">32명 접속 중</span></div>
        ) : (
          <div className="student-room__quiz">
            {room.phase === 'results' ? (
              <StudentQuizResults quiz={roomQuiz} answers={room.answers} initialIndex={preview === 'results' ? 2 : 0} />
            ) : (
              <StudentQuizQuestion question={room.question} index={room.index} total={roomQuiz.questions.length} phase={room.phase} secondsLeft={room.secondsLeft} selected={room.answers[room.index]} submitted={room.submitted} onSelect={room.selectAnswer} onSubmit={room.submitAnswer} />
            )}
          </div>
        )}
        <StudentChat nickname={session.nickname} expanded={waiting} messages={room.messages} reactions={room.reactions} onSend={room.sendMessage} onReact={room.sendReaction} />
      </main>
    </div>
  )
}
