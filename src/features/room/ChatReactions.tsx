import type { FloatingReaction } from './reactions'
import './ChatReactions.css'

export function ChatReactions({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="chat-reactions" aria-live="polite" aria-relevant="additions">
      {reactions.map(({ id, emoji, lane }) => (
        <span key={id} className="chat-reactions__emoji" style={{ left: `${12 + lane * 23}%` }}>
          {emoji}
        </span>
      ))}
    </div>
  )
}
