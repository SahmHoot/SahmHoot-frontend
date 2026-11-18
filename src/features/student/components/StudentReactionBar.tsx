import { REACTION_EMOJIS } from '../../room/reactions'
import type { Reaction } from '../../room/reactions'
import './StudentReactionBar.css'

const labels: Record<Reaction, string> = {
  '👍': '좋아요', '❓': '궁금해요', '😀': '즐거워요', '👏': '박수',
}

export default function StudentReactionBar({ onReact, expanded }: { onReact: (reaction: Reaction) => void; expanded: boolean }) {
  return (
    <div className="student-reactions" aria-label="수업 반응">
      {REACTION_EMOJIS.map((emoji) => <button type="button" className="student-button" key={emoji} onClick={() => onReact(emoji)} aria-label={labels[emoji]}>{emoji}</button>)}
      {expanded && <span className="student-reactions__hint">누르면 교수 화면에 바로 집계됩니다</span>}
    </div>
  )
}
