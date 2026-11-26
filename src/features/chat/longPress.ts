import type { MouseEvent, PointerEvent } from 'react'

/**
 * 터치로 0.5초 이상 누르면 손을 뗀 뒤 open을 부른다.
 * 누르는 중에 팝오버를 열면 손을 떼는 순간 바깥 누름으로 보고 바로 닫히므로 뗀 다음 차례에 연다.
 * 꾹 누른 뒤 따라오는 click은 handled()가 true라 말풍선의 원래 동작(답글)을 건너뛸 수 있다.
 */
export function createLongPress(open: (target: HTMLElement) => void, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let long = false
  let touch = false
  const finish = (event: PointerEvent<HTMLElement>) => {
    clearTimeout(timer)
    if (!long) return
    const target = event.currentTarget
    setTimeout(() => open(target), 0)
  }
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      clearTimeout(timer)
      long = false
      touch = event.pointerType === 'touch'
      if (touch) timer = setTimeout(() => { long = true }, delay)
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onPointerLeave() { clearTimeout(timer) },
    /** 휴대폰 기본 길게 누르기 메뉴(복사 등) 대신 관리 메뉴를 띄운다. */
    onContextMenu(event: MouseEvent<HTMLElement>) { if (touch) event.preventDefault() },
    handled: () => long,
  }
}
