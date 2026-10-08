import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import ProfessorRoutes from './app/ProfessorRoutes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/professor" replace />} />
        <Route path="/professor/*" element={<ProfessorRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
