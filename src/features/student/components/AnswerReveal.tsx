import type { CSSProperties } from 'react'
import './AnswerReveal.css'

const colors = ['#6554ff', '#b8f35e', '#56d6d5', '#b49aff']
const particles = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2
  return {
    '--particle-x': `${Math.cos(angle) * (82 + index % 3 * 18)}px`,
    '--particle-y': `${Math.sin(angle) * (48 + index % 4 * 12)}px`,
    '--particle-rotation': `${index * 47 + 90}deg`,
    '--particle-delay': `${index % 3 * 30}ms`,
    '--particle-color': colors[index % colors.length],
  } as CSSProperties
})

export function AnswerParticles() {
  return <span className="answer-particles" aria-hidden="true">
    {particles.map((style, index) => <span key={index} className="answer-particles__piece" style={style} />)}
  </span>
}
