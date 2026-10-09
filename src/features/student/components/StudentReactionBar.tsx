import type { Reaction } from '../types/student.types'
import './StudentReactionBar.css'

const reactions: { emoji: Reaction; label: string }[] = [
  { emoji: '👍', label: '좋아요' }, { emoji: '❓', label: '궁금해요' },
  { emoji: '😄', label: '즐거워요' }, { emoji: '👏', label: '박수' },
]

export default function StudentReactionBar({ onReact, expanded }: { onReact: (reaction: Reaction) => void; expanded: boolean }) {
  return (
    <div className="student-reactions" aria-label="수업 반응">
      {reactions.map(({ emoji, label }) => <button className="student-button" key={emoji} onClick={() => onReact(emoji)} aria-label={label}>{emoji}</button>)}
      {expanded && <span className="student-reactions__hint">누르면 교수 화면에 바로 집계됩니다</span>}
    </div>
  )
}
