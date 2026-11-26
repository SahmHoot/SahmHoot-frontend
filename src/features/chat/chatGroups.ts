import type { RoomChatMessage } from '../../shared/types/roomState'

type Line = Pick<RoomChatMessage, 'senderParticipantId' | 'isOwner' | 'createdAt'>

const GROUP_MS = 60_000

/** 같은 사람이 앞 메시지 뒤 1분 안에 이어 보낸 메시지를 한 묶음으로 나눈다. 이름은 묶음 처음에, 시간·관리는 묶음 끝에 붙인다. */
export function groupChat<T extends Line>(messages: T[]): T[][] {
  const groups: T[][] = []
  for (const message of messages) {
    const group = groups[groups.length - 1]
    const previous = group?.[group.length - 1]
    if (previous && previous.senderParticipantId === message.senderParticipantId && previous.isOwner === message.isOwner
      && Date.parse(message.createdAt) - Date.parse(previous.createdAt) < GROUP_MS) group.push(message)
    else groups.push([message])
  }
  return groups
}

/** 「오후 3:05」 */
export const chatTime = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
