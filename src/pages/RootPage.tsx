import { useEffect, useState } from 'react'
import { apiClient } from '../shared/api/client'

interface HealthResponse {
  status: string
}

export default function RootPage() {
  const [backendStatus, setBackendStatus] = useState<'UP' | 'ERROR' | 'LOADING'>('LOADING')

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await apiClient.get<HealthResponse>('/health')
        if (response.data.status === 'UP') {
          setBackendStatus('UP')
        } else {
          setBackendStatus('ERROR')
        }
      } catch {
        setBackendStatus('ERROR')
      }
    }

    checkHealth()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">SahmHoot Frontend</h1>
        <div className="text-xl text-gray-600">
          Backend Status:{' '}
          <span
            className={`font-semibold ${
              backendStatus === 'UP' ? 'text-green-600' : backendStatus === 'ERROR' ? 'text-red-600' : 'text-gray-500'
            }`}
          >
            {backendStatus === 'LOADING' ? 'LOADING' : backendStatus}
          </span>
        </div>
      </div>
    </div>
  )
}
