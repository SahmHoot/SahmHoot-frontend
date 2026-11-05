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
          <Route path="/student/*" element={<RequireAuth role="STUDENT"><StudentRoutes /></RequireAuth>} />
          <Route path="/join/:code" element={<RequireAuth role="STUDENT"><StudentJoin /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
