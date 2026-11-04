import { useEffect, useState } from 'react'
import { remainingSeconds } from '../serverClock'

const TICK_MS = 250

/** 서버 시각 기준으로 targetAt까지 남은 초를 돌려준다. */
export function useServerCountdown(targetAt: string, offsetMs: number): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  return remainingSeconds(targetAt, offsetMs, now)
}
