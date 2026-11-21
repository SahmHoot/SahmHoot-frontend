import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnswerParticles } from './AnswerReveal'
import './AnswerRevealOverlay.css'

const DURATION_MS = 2600

interface Props {
  answer: string
  correct: boolean
  answered: boolean
}

/** A single reveal fits inside the server's three-second feedback phase. */
export function AnswerRevealOverlay({ answer, correct, answered }: Props) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible || typeof document === 'undefined') return null
  const verdict = correct ? '맞았어요!' : answered ? '정답을 확인해요' : '정답 공개'
  const symbol = answer.trim().toUpperCase()
  const isSymbol = symbol === 'O' || symbol === 'X'
  return createPortal(
    <div className="answer-stage" data-outcome={correct ? 'correct' : 'neutral'} role="status" aria-live="polite" aria-atomic="true">
      <span className="answer-stage__announcement">정답은 {answer}. {verdict}</span>
      <div className="answer-stage__scene" aria-hidden="true">
        <div className="answer-stage__registration answer-stage__registration--first" />
        <div className="answer-stage__registration answer-stage__registration--second" />
        <div className="answer-stage__drum"><span>두구</span><span>두구</span><span>두구…</span></div>
        <div className="answer-stage__reveal">
          <span className="answer-stage__eyebrow">정답은</span>
          <div className="answer-stage__token" data-symbol={isSymbol}>
            <div className="answer-stage__face answer-stage__face--back" />
            <div className="answer-stage__side answer-stage__side--left" />
            <div className="answer-stage__side answer-stage__side--right" />
            <div className="answer-stage__edge answer-stage__edge--top" />
            <div className="answer-stage__edge answer-stage__edge--bottom" />
            <div className="answer-stage__face answer-stage__face--front">
              <strong className="answer-stage__answer" data-short={isSymbol} data-long={answer.length > 90}>{answer}</strong>
            </div>
          </div>
          <strong className="answer-stage__verdict">{verdict}</strong>
          <div className="answer-stage__burst"><AnswerParticles /></div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
