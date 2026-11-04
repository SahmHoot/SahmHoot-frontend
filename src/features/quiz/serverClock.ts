/**
 * 서버 시각 기준 남은 시간 계산(06 4절).
 * 기기 시계가 틀려도 카운트다운이 맞도록, 메시지의 sentAt과 받은 시각의 차이를 보정값으로 쓴다.
 */

/** 서버 시계가 기기 시계보다 앞선 밀리초. 뒤처지면 음수다. */
export function clockOffsetMs(sentAt: string, receivedAt: number): number {
  return Date.parse(sentAt) - receivedAt
}

/** targetAt까지 남은 초. 1초 미만도 1초로 올려 보여 주고, 지났으면 0이다. */
export function remainingSeconds(targetAt: string, offsetMs: number, now: number): number {
  const serverNow = now + offsetMs
  return Math.max(0, Math.ceil((Date.parse(targetAt) - serverNow) / 1000))
}
