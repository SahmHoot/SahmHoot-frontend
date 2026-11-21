import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsx from 'react/jsx-runtime'
import ts from 'typescript'

function harness({ correct = true, answered = true, documentAvailable = true } = {}) {
  let visible = true
  let started = false
  let cleanup
  let delay
  let callback
  let portalCount = 0
  const body = {}
  const source = readFileSync(new URL('../src/features/student/components/AnswerRevealOverlay.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  const dependencies = {
    react: { useState: () => [visible, next => { visible = next }], useEffect(effect) { if (!started) { started = true; cleanup = effect() } } },
    'react-dom': { createPortal(tree, target) { assert.equal(target, body); portalCount++; return tree } },
    'react/jsx-runtime': jsx,
    './AnswerReveal': { AnswerParticles: () => null }, './AnswerRevealOverlay.css': {},
  }
  runInNewContext(outputText, { exports, ...(documentAvailable ? { document: { body } } : {}),
    window: { setTimeout(fn, milliseconds) { callback = fn; delay = milliseconds; return 1 }, clearTimeout() { callback = null } },
    require(id) { if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`); return dependencies[id] },
  })
  const render = () => exports.AnswerRevealOverlay({ answer: 'O', correct, answered })
  return { render, unmount: () => cleanup?.(), get delay() { return delay }, get pending() { return callback !== null },
    get portalCount() { return portalCount }, finish() { callback(); callback = null } }
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  return typeof value === 'object' ? text(value.props?.children) : String(value)
}

test('정답 오버레이는 화면 전체 포털로 한 번 표시되고 3초 안에 자동으로 사라진다', () => {
  const overlay = harness()
  const tree = overlay.render()
  assert.equal(overlay.portalCount, 1)
  assert.equal(tree.props.role, 'status')
  assert.match(text(tree), /정답은 O.*맞았어요!/)
  assert.ok(overlay.delay > 2000 && overlay.delay < 3000)
  overlay.finish()
  assert.equal(overlay.render(), null)
  assert.equal(overlay.portalCount, 1)
})

test('오답·미응답에는 맞혔다고 표시하지 않는다', () => {
  for (const answered of [true, false]) {
    const overlay = harness({ correct: false, answered })
    const tree = overlay.render()
    assert.doesNotMatch(text(tree), /맞았어요/)
    assert.match(text(tree), /정답은 O/)
    overlay.unmount()
    assert.equal(overlay.pending, false)
  }
})

test('문항 전환으로 사라지면 예약 타이머를 취소하고 서버 렌더링에서는 포털을 만들지 않는다', () => {
  const overlay = harness()
  overlay.render()
  overlay.unmount()
  assert.equal(overlay.pending, false)
  const server = harness({ documentAvailable: false })
  assert.equal(server.render(), null)
  assert.equal(server.portalCount, 0)
  server.unmount()
})
