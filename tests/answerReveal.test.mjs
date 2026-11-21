import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsx from 'react/jsx-runtime'
import ts from 'typescript'

function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/student/components/${name}.tsx`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  runInNewContext(outputText, { exports, require(id) {
    if (id === 'react/jsx-runtime') return jsx
    if (id.endsWith('.css')) return {}
    if (id in dependencies) return dependencies[id]
    throw new Error(`Unexpected import: ${id}`)
  } })
  return exports
}
const reveal = load('AnswerReveal')
const { default: Options } = load('StudentAnswerOptions', { './AnswerReveal': reveal })
function expand(value) {
  if (Array.isArray(value)) return value.map(expand)
  if (!value || typeof value !== 'object') return value
  if (typeof value.type === 'function') return expand(value.type(value.props))
  return { ...value, props: { ...value.props, children: expand(value.props.children) } }
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  return value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('')
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  return typeof value === 'object' ? text(value.props?.children) : String(value)
}
const hasClass = (node, name) => node.props?.className?.split(' ').includes(name)
const render = (props = {}) => expand(Options({ options: ['가', '나', '다', '라'], selected: 1, correctAnswer: 1, ...props }))

test('마감 전에는 선택 모션만 사용하고 정답 안내나 파티클을 노출하지 않는다', () => {
  const tree = render()
  assert.ok(!nodes(tree).some(node => hasClass(node, 'answer-reveal') || hasClass(node, 'answer-particles')))
  assert.ok(!nodes(tree).some(node => hasClass(node, 'student-answers__result-label')))
  const buttons = nodes(tree).filter(node => node.type === 'button')
  assert.equal(buttons.length, 4)
  assert.equal(buttons[1].props['aria-pressed'], true)
})

test('정답 공개는 올바른 카드에만 파티클을 붙이고 내 선택을 함께 안내한다', () => {
  const tree = render({ mode: 'results' })
  assert.ok(!nodes(tree).some(node => hasClass(node, 'answer-reveal')))
  const correct = nodes(tree).find(node => hasClass(node, 'student-answers__option--correct'))
  assert.match(text(correct), /정답 · 내 선택/)
  assert.ok(nodes(correct).some(node => hasClass(node, 'answer-particles') && node.props['aria-hidden'] === 'true'))
  assert.equal(nodes(tree).filter(node => hasClass(node, 'answer-particles')).length, 1)
  assert.equal(nodes(tree).filter(node => node.type === 'button').length, 0)
})

test('오답을 골라도 정답과 내 답을 구별하며 잘못 고른 카드에는 축하 이펙트를 붙이지 않는다', () => {
  const tree = render({ selected: 0, mode: 'review' })
  const wrong = nodes(tree).find(node => hasClass(node, 'student-answers__option--wrong'))
  assert.match(text(wrong), /내가 고른 답/)
  assert.ok(!nodes(wrong).some(node => hasClass(node, 'answer-particles')))
  assert.equal(nodes(tree).filter(node => hasClass(node, 'student-answers__option--quiet')).length, 2)
})

test('정답 정보가 없거나 범위를 벗어나면 정답 이펙트를 만들지 않는다', () => {
  for (const correctAnswer of [undefined, -1, 4]) {
    const tree = render({ correctAnswer, mode: 'results' })
    assert.ok(!nodes(tree).some(node => hasClass(node, 'answer-reveal') || hasClass(node, 'answer-particles')))
  }
})

test('미응답 OX는 배너 없이 정답 카드만 강조한다', () => {
  const tree = render({ options: ['O', 'X'], selected: null, correctAnswer: 0, mode: 'results' })
  assert.ok(!nodes(tree).some(node => hasClass(node, 'answer-reveal')))
  assert.doesNotMatch(text(tree), /함께 확인해요|딱 맞았어요|정답은 여기/)
  assert.equal(nodes(tree).filter(node => hasClass(node, 'student-answers__option')).length, 2)
  assert.equal(nodes(tree).filter(node => hasClass(node, 'answer-particles')).length, 1)
})
