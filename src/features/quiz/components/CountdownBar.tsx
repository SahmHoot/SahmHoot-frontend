import { useLayoutEffect, useRef } from 'react'
import './CountdownBar.css'

interface Props {
  closesAt: string
  clockOffsetMs: number
  timeLimitSeconds: number
  secondsLeft: number
  active: boolean
  urgent: boolean
  valueText: string
}

/** Visual frames use the server deadline; text and accessibility stay on whole seconds. */
export function CountdownBar({ closesAt, clockOffsetMs, timeLimitSeconds, secondsLeft, active, urgent, valueText }: Props) {
  const fillRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const fill = fillRef.current
    if (!fill) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame: number | undefined
    function draw() {
      const milliseconds = active ? Math.max(0, Date.parse(closesAt) - (Date.now() + clockOffsetMs)) : 0
      const remaining = motion.matches ? Math.ceil(milliseconds / 1000) : milliseconds / 1000
      const fraction = timeLimitSeconds > 0 ? Math.min(1, remaining / timeLimitSeconds) : 0
      fill!.style.transform = `scaleX(${fraction})`
      if (active && milliseconds > 0) frame = window.requestAnimationFrame(draw)
    }
    draw()
    return () => { if (frame !== undefined) window.cancelAnimationFrame(frame) }
  }, [active, closesAt, clockOffsetMs, timeLimitSeconds])

  return <div className="quiz-countdown" role="progressbar" aria-label="남은 시간"
    aria-valuemin={0} aria-valuemax={timeLimitSeconds}
    aria-valuenow={active ? Math.max(0, Math.min(secondsLeft, timeLimitSeconds)) : 0}
    aria-valuetext={valueText} data-urgent={urgent}>
    <div ref={fillRef} className="quiz-countdown__fill" aria-hidden="true" />
  </div>
}
