import './Chat.css'

// 흰 글씨와 대비 4.5:1 이상인 색. 교수는 서비스 기본색을 쓰고 학생은 참가자 번호로 고른다.
const studentColors = ['#0e7c66', '#b45309', '#9333ea', '#be185d', '#57534e', '#4d7c0f', '#c2410c']
const ownerColor = '#2538d2'

export function avatarColor(participantId: number, isOwner = false): string {
  return isOwner ? ownerColor : studentColors[Math.abs(participantId) % studentColors.length]
}

/** 닉네임 첫 글자를 넣은 동그라미. 이름이 바로 옆에 있으므로 화면 낭독기에는 읽히지 않게 한다. */
export function ChatAvatar({ name, participantId, isOwner = false, className = 'chat-avatar' }: {
  name: string; participantId: number; isOwner?: boolean; className?: string
}) {
  return <span className={className} aria-hidden="true" style={{ background: avatarColor(participantId, isOwner), color: 'white' }}>
    {Array.from(name.trim())[0] ?? '?'}
  </span>
}
