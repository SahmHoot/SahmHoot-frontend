import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import ProfessorRoutes from './app/ProfessorRoutes'
import StudentRoutes from './app/StudentRoutes'
import StudentJoin from './features/student/screens/StudentJoin'
import { LoginPage, SignupPage } from './login_signup_pages'
import RootPage from './pages/RootPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/health" element={<RootPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/professor/*" element={<ProfessorRoutes />} />
        <Route path="/student/*" element={<StudentRoutes />} />
        <Route path="/join/:code" element={<StudentJoin />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
