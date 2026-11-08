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

/**
 * 서버 시각 문자열 두 개를 비교한다(앞이면 음수, 같으면 0, 뒤면 양수).
 * 서버는 마이크로초까지 보내는데 Date.parse는 밀리초에서 자르므로, 소수점 아래를 직접 비교한다.
 */
export function compareServerTime(a: string, b: string): number {
  const [aSeconds, aFraction] = splitFraction(a)
  const [bSeconds, bFraction] = splitFraction(b)
  const bySeconds = Date.parse(aSeconds) - Date.parse(bSeconds)
  if (bySeconds !== 0) return bySeconds
  return aFraction < bFraction ? -1 : aFraction > bFraction ? 1 : 0
}

/** '2026-11-08T10:00:00.0005Z' → ['2026-11-08T10:00:00Z', '000500000'] */
function splitFraction(time: string): [string, string] {
  const match = /^(.*?)(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/.exec(time)
  if (!match) return [time, '000000000']
  return [match[1] + match[3], (match[2] ?? '').padEnd(9, '0').slice(0, 9)]
}
