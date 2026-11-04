import { useEffect, useReducer } from 'react'
import { remainingSeconds } from '../serverClock'

const TICK_MS = 250

/**
 * 서버 시각 기준으로 targetAt까지 남은 초를 돌려준다.
 * 현재 시각을 그릴 때마다 새로 읽어, 메시지를 받은 직후에도 몇백 ms 전 시각으로 계산하지 않는다.
 */
export function useServerCountdown(targetAt: string, offsetMs: number): number {
  const [, tick] = useReducer((count: number) => count + 1, 0)

  useEffect(() => {
    const timer = window.setInterval(tick, TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  return remainingSeconds(targetAt, offsetMs, Date.now())
}
