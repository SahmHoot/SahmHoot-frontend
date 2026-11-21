import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

function harness({ offset = 0, active = true, reducedMotion = false } = {}) {
  let now = 0
  let sequence = 0
  let cleanup
  const frames = new Map()
  const fill = { style: {} }
  const source = readFileSync(new URL('../src/features/quiz/components/CountdownBar.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  runInNewContext(outputText, {
    exports, Date: class extends Date { static now() { return now } },
    window: { matchMedia: () => ({ matches: reducedMotion }),
      requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id },
      cancelAnimationFrame(id) { frames.delete(id) },
    },
    require(id) {
      if (id === 'react') return { useRef: () => ({ current: fill }), useLayoutEffect: effect => { cleanup = effect() } }
      if (id === 'react/jsx-runtime') return jsxRuntime
      if (id.endsWith('.css')) return {}
      throw new Error(`Unexpected dependency: ${id}`)
    },
  })
  exports.CountdownBar({ closesAt: new Date(60000 + offset).toISOString(), clockOffsetMs: offset,
    timeLimitSeconds: 60, secondsLeft: 60, active, urgent: false, valueText: '60초 남음' })
  return {
    get fraction() { return Number(fill.style.transform.match(/scaleX\(([^)]+)\)/)[1]) },
    get pending() { return frames.size },
    step(milliseconds) { now += milliseconds; const ready = [...frames.values()]; frames.clear(); ready.forEach(callback => callback(now)) },
    unmount() { cleanup?.() },
  }
}

test('초 숫자가 바뀌기 전에도 매 프레임 시간 바가 연속해서 줄어든다', () => {
  const bar = harness()
  assert.equal(bar.fraction, 1)
  bar.step(16)
  const first = bar.fraction
  assert.ok(first < 1 && first > 0.99)
  bar.step(16)
  assert.ok(bar.fraction < first && bar.fraction > 0.99)
  assert.equal(bar.pending, 1)
  bar.unmount()
})

test('백그라운드에서 돌아와도 프레임 횟수가 아닌 실제 마감 시각으로 복원한다', () => {
  const bar = harness()
  bar.step(30000)
  assert.equal(bar.fraction, 0.5)
  bar.step(60000)
  assert.equal(bar.fraction, 0)
  assert.equal(bar.pending, 0)
})

test('브라우저 시계가 서버와 달라도 같은 남은 비율을 표시한다', () => {
  for (const offset of [-300000, 300000]) {
    const bar = harness({ offset })
    bar.step(15000)
    assert.equal(bar.fraction, 0.75)
    bar.unmount()
  }
})

test('문항 마감 후에는 바가 0이고 화면을 떠나면 예약 프레임을 취소한다', () => {
  const closed = harness({ active: false })
  assert.equal(closed.fraction, 0)
  assert.equal(closed.pending, 0)
  const running = harness()
  assert.equal(running.pending, 1)
  running.unmount()
  assert.equal(running.pending, 0)
})

test('동작 줄이기를 요청한 환경에서는 초 단위 갱신을 유지한다', () => {
  const bar = harness({ reducedMotion: true })
  bar.step(16)
  assert.equal(bar.fraction, 1)
  bar.step(1000)
  assert.equal(bar.fraction, 59 / 60)
  bar.unmount()
})
