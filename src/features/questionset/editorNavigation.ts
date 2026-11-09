// BrowserRouter가 history 리스너를 등록하기 전에 설치한다.
// window 자체가 popstate의 target이므로 저장 시작 후 등록하면 라우터가 먼저 처리할 수 있다.
let activePopstate: ((event: PopStateEvent) => void) | undefined
window.addEventListener('popstate', (event) => activePopstate?.(event), true)

/** BrowserRouter를 교체하지 않고 저장 요청 동안 링크와 동일 문서 history 이동을 막는다. */
export function lockEditorNavigation() {
  const savedUrl = window.location.href
  const savedState: unknown = window.history.state
  const savedIndex = historyIndex(savedState)
  let active = true
  let returning = false
  let releaseRequested = false
  let resolveRelease: (() => void) | undefined
  const preventLink = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault()
    event.returnValue = ''
  }
  const popstate = (event: PopStateEvent) => {
    event.stopImmediatePropagation()
    const currentIndex = historyIndex(window.history.state)
    if (savedIndex !== undefined && currentIndex !== undefined && currentIndex !== savedIndex) {
      returning = true
      window.history.go(savedIndex - currentIndex)
    } else {
      // idx가 없는 외부 history 항목은 원래 URL만 복원할 수 있다.
      if (window.location.href !== savedUrl) window.history.replaceState(savedState, '', savedUrl)
      returning = false
      if (releaseRequested) release()
    }
  }
  const release = () => {
    if (returning) { releaseRequested = true; return }
    if (!active) return
    active = false
    window.removeEventListener('beforeunload', beforeUnload)
    document.removeEventListener('click', preventLink, true)
    if (activePopstate === popstate) activePopstate = undefined
    resolveRelease?.()
  }
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('click', preventLink, true)
  activePopstate = popstate
  return () => new Promise<void>((resolve) => {
    if (!active) { resolve(); return }
    resolveRelease = resolve
    releaseRequested = true
    release()
  })
}

function historyIndex(state: unknown): number | undefined {
  return state && typeof state === 'object' && 'idx' in state && typeof state.idx === 'number' ? state.idx : undefined
}
