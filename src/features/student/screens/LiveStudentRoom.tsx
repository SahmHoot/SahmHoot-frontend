import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog'
import { useClassroom } from '../../room/useClassroom'
import { RoomEndedNotice } from '../../room/RoomEndedNotice'
import { ClassroomStatus } from '../../room/ClassroomStatus'
import { useServerCountdown } from '../../quiz/hooks/useServerCountdown'
import type { ProfessorQuizState } from '../../quiz/professorQuizReducer'
import StudentHeader from '../components/StudentHeader'
import StudentChat from '../components/StudentChat'
import StudentQuizQuestion from '../components/StudentQuizQuestion'
import { writeSession } from '../data/studentStorage'
import './StudentRoom.css'

export default function LiveStudentRoom({ roomId }: { roomId: number }) {
  const navigate = useNavigate()
  const classroom = useClassroom(roomId, false)
  const [leaving, setLeaving] = useState(false)
  const home = () => { writeSession(null); navigate('/student', { replace: true }) }
  const { snapshot, quiz, onlineCount, ended, error } = classroom
  const waiting = quiz.phase === 'waiting'
  const messages = snapshot?.recentMessages.map((message) => ({ id: String(message.id), nickname: message.nickname,
    text: message.content, role: message.isOwner ? 'professor' as const : 'student' as const,
    mine: message.senderParticipantId === snapshot.me.participantId })) ?? []

  return <div className="student-app">
    <StudentHeader title={snapshot?.room.title} nickname={snapshot?.me.nickname} onLeave={() => setLeaving(true)} />
    {ended ? <RoomEndedNotice onHome={home} /> : !snapshot || error ? <ClassroomStatus error={error} onHome={home} /> :
      <main className={`student-room ${waiting ? 'student-room--waiting' : ''}`}>
        {waiting ? <div className="student-room__waiting-banner"><p><strong>대기 중</strong><span>교수님의 다음 안내를 기다려 주세요.</span></p><span>접속 {onlineCount}명</span></div> :
          <div className="student-room__quiz">
            {quiz.phase === 'results' ? <section className="student-card student-results"><h2>퀴즈가 종료되었습니다</h2><p>교수님의 다음 안내를 기다려 주세요.</p></section> :
              <LiveQuestion quiz={quiz} />}
          </div>}
        {/* shortcut: 채팅·답 제출은 해당 기능 연동 전까지 읽기 전용, #30과 채팅 이슈에서 연결한다. */}
        <StudentChat nickname={snapshot.me.nickname} expanded={waiting} messages={messages} reactions={[]}
          onlineCount={onlineCount} notice={snapshot.pinnedMessage?.content ?? null} readOnly onSend={() => {}} onReact={() => {}} />
      </main>}
    {leaving && !ended && <ConfirmDialog title="수업에서 나갈까요?" message="수업에서 나가 홈으로 이동합니다."
      cancelLabel="수업 계속하기" confirmLabel="수업 나가기" onCancel={() => setLeaving(false)} onConfirm={home} />}
  </div>
}

function LiveQuestion({ quiz }: { quiz: Extract<ProfessorQuizState, { phase: 'question' | 'between' }> }) {
  const seconds = useServerCountdown(quiz.phase === 'between' ? quiz.nextOpensAt : quiz.closesAt, quiz.clockOffsetMs)
  return <StudentQuizQuestion question={{ title: quiz.content, options: quiz.choices.map((choice) => choice.content), correctAnswer: -1 }}
    index={quiz.questionNo - 1} total={quiz.totalQuestions} phase={quiz.phase === 'between' ? 'feedback' : seconds === 0 ? 'closing' : 'question'}
    secondsLeft={seconds} selected={null} submitted={false} readOnly onSelect={() => {}} onSubmit={() => {}} />
}
