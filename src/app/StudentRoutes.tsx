import { Navigate, Route, Routes } from 'react-router-dom'
import RootPage from '../pages/RootPage'
import StudentJoin from '../features/student/screens/StudentJoin'
import StudentRoom from '../features/student/screens/StudentRoom'
import StudentQuizReview from '../features/student/screens/StudentQuizReview'
import '../features/student/styles/student-common.css'

export default function StudentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student" replace />} />
      <Route path="/student" element={<StudentJoin />} />
      <Route path="/student/join" element={<StudentJoin />} />
      <Route path="/student/join/:code" element={<StudentJoin />} />
      <Route path="/student/room/:code" element={<StudentRoom />} />
      <Route path="/student/review/:setId" element={<StudentQuizReview />} />
      <Route path="/health" element={<RootPage />} />
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  )
}
