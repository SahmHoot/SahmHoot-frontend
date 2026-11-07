import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import ProfessorRoutes from './app/ProfessorRoutes'
import StudentRoutes from './app/StudentRoutes'
import { AuthProvider } from './features/auth/AuthProvider'
import { HomeRedirect, RequireAuth } from './features/auth/components/RequireAuth'
import StudentJoin from './features/student/screens/StudentJoin'
import { LoginPage, SignupPage } from './login_signup_pages'
import RootPage from './pages/RootPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/health" element={<RootPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/professor/*" element={<RequireAuth role="PROFESSOR"><ProfessorRoutes /></RequireAuth>} />
          {/* 수업 참여와 QR 입장은 역할과 관계없이 연다. 교수도 다른 교수의 수업에는 참여자로 들어간다(ACC-06). */}
          <Route path="/student/*" element={<RequireAuth><StudentRoutes /></RequireAuth>} />
          <Route path="/join/:code" element={<RequireAuth><StudentJoin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
