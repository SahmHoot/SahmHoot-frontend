const prefix = 'sahmhoot.professor.room.'

export function readRoomId(userId: number | undefined): number | null {
  if (userId === undefined) return null
  try {
    const id = Number(sessionStorage.getItem(`${prefix}${userId}`))
    return Number.isSafeInteger(id) && id > 0 ? id : null
  } catch { return null }
}

export function writeRoomId(userId: number | undefined, roomId: number | null): void {
  if (userId === undefined) return
  try {
    if (roomId === null) sessionStorage.removeItem(`${prefix}${userId}`)
    else sessionStorage.setItem(`${prefix}${userId}`, String(roomId))
  } catch { /* 저장소 없이도 현재 화면은 사용할 수 있다. */ }
}
