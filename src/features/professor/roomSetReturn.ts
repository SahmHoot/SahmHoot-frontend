export const roomSetSaved = 'sahmhoot:room-set-saved'

export function getRoomTab(roomPath: string): Window | null {
  const tab: Window | null = window.opener
  try {
    return tab && !tab.closed && tab.location.origin === window.location.origin &&
      tab.location.pathname === roomPath ? tab : null
  } catch {
    return null
  }
}
