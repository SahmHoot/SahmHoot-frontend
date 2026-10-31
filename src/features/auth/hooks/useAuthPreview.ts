import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthRole } from '../auth.types'

export function useLoginPreview() {
  const navigate = useNavigate()
  const location = useLocation()
  const incoming = location.state as { previewRole?: unknown } | null
  const [previewRole, setPreviewRole] = useState<AuthRole>(
    import.meta.env.DEV && incoming?.previewRole === 'STUDENT' ? 'STUDENT' : 'PROFESSOR',
  )
  const [feedback, setFeedback] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (import.meta.env.DEV) {
      navigate(previewRole === 'PROFESSOR' ? '/professor' : '/student')
      return
    }
    setFeedback('현재 로그인 서비스를 사용할 수 없습니다.')
  }

  return { previewRole, setPreviewRole, feedback, handleSubmit }
}
