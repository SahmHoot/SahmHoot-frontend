import { Navigate, Route, Routes } from 'react-router-dom'
import StudentJoin from '../features/student/screens/StudentJoin'
import StudentRoom from '../features/student/screens/StudentRoom'
import StudentQuizReview from '../features/student/screens/StudentQuizReview'
import '../features/student/styles/student-common.css'

export default function StudentRoutes() {
  return (
    <Routes>
      <Route index element={<StudentJoin />} />
      <Route path="join" element={<StudentJoin />} />
      <Route path="join/:code" element={<StudentJoin />} />
      <Route path="room/:code" element={<StudentRoom />} />
      <Route path="review/:setId" element={<StudentQuizReview />} />
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  )
}
