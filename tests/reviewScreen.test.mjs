import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsx from 'react/jsx-runtime'
import ts from 'typescript'

const quiz = { title: '복습', ownerName: '교수', questions: [
  { id: 10, type: 'MULTIPLE_CHOICE', content: '객관식', choices: ['가', '나', '다', '라'].map((content, i) => ({ id: 101 + i, content, isCorrect: i === 1 })) },
  { id: 20, type: 'TRUE_FALSE', content: 'OX 문제', choices: [{ id: 201, content: 'O', isCorrect: true }, { id: 202, content: 'X', isCorrect: false }] },
] }

function load(file, dependencies, extra = '') {
  const source = readFileSync(new URL(`../src/features/${file}`, import.meta.url), 'utf8') + extra
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  runInNewContext(outputText, { exports, require(id) {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return exports
}

// 실제 화면과 기존 선택지 컴포넌트를 실행한다. 저장소·네트워크 쓰기는 제공하지 않는다.
function harness() {
  const cells = []
  let cursor = 0
  const react = { useState(initial) {
    const i = cursor++
    cells[i] ??= { value: initial }
    return [cells[i].value, value => { cells[i].value = typeof value === 'function' ? value(cells[i].value) : value }]
  } }
  const options = load('student/components/StudentAnswerOptions.tsx', {
    'react/jsx-runtime': jsx, '../../../assets/student/check.svg': 'check.svg',
    '../data/studentFixtures': { optionLabels: ['①', '②', '③', '④'] }, './StudentAnswerOptions.css': {},
  })
  const { ReviewContent } = load('student/screens/StudentQuizReview.tsx', {
    react, 'react/jsx-runtime': jsx, 'react-router-dom': { Link: 'a' },
    '../../../assets/student/chevron-left.svg': 'left.svg', '../../../assets/student/chevron-right.svg': 'right.svg',
    '../components/StudentHeader': {}, '../components/StudentAnswerOptions': options,
    '../../review/api': {}, '../../review/useReviewResource': {}, './StudentQuizReview.css': {},
  }, '\nexport { ReviewContent }\n')
  let tree
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand)
    if (!value || typeof value !== 'object') return value
    if (typeof value.type === 'function') return expand(value.type(value.props))
    return { ...value, props: { ...value.props, children: expand(value.props.children) } }
  }
  function render() { cursor = 0; tree = expand(ReviewContent({ quiz })); return tree }
  render()
  return { render, nodes: () => nodes(tree), text: () => content(tree),
    select(index) {
      const button = nodes(tree).filter(n => n.type === 'button' && n.props.className?.includes('student-answers__option'))[index]
      assert.ok(button && !button.props.disabled)
      button.props.onClick(); render()
    },
    click(label) {
      const button = nodes(tree).find(n => n.type === 'button' && content(n) === label)
      assert.ok(button && !button.props.disabled, `활성 버튼: ${label}`)
      button.props.onClick(); render()
    },
  }
}
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!value || typeof value !== 'object') return []
  return [value, ...nodes(value.props?.children)]
}
function content(value) {
  if (Array.isArray(value)) return value.map(content).join('')
  if (value === null || value === undefined || typeof value === 'boolean') return ''
  return typeof value === 'object' ? content(value.props?.children) : String(value)
}
const optionNodes = h => h.nodes().filter(n => n.props?.className?.split(' ').includes('student-answers__option'))

test('객관식은 ①~④를 표시하고 확인 전에는 선택을 변경할 수 있다', () => {
  const h = harness()
  assert.deepEqual(h.nodes().filter(n => n.props?.className?.startsWith('student-answers__number ')).map(content), ['①', '②', '③', '④'])
  h.select(0); h.select(1)
  assert.equal(optionNodes(h)[0].props['aria-pressed'], false)
  assert.equal(optionNodes(h)[1].props['aria-pressed'], true)
  h.click('정답 확인')
  assert.match(h.text(), /정답입니다/)
  assert.ok(optionNodes(h).every(n => n.type === 'div'), '확인 후에는 선택 버튼을 렌더링하지 않는다')
})

test('오답·정답 피드백과 선택·확인 상태를 문항 이동 후에도 유지한다', () => {
  const h = harness()
  h.select(0); h.click('정답 확인')
  assert.match(content(optionNodes(h)[0]), /내가 고른 답/)
  assert.match(content(optionNodes(h)[1]), /정답/)
  assert.match(h.text(), /오답입니다/)
  h.click('다음 문항')
  assert.deepEqual(h.nodes().filter(n => n.props?.className === 'student-answers__text').map(content), ['O', 'X'])
  assert.doesNotMatch(h.text(), /O O|X X/)
  h.select(1); h.click('이전 문항')
  assert.ok(optionNodes(h).every(n => n.type === 'div'))
  assert.match(content(optionNodes(h)[0]), /내가 고른 답/)
  h.click('다음 문항')
  assert.equal(optionNodes(h)[1].props['aria-pressed'], true, '미확인 선택도 유지')
  h.select(0); h.click('정답 확인'); h.click('복습 완료')
  assert.match(h.text(), /복습을 마쳤어요/)
  assert.match(h.text(), /풀이 결과는 저장되지 않습니다/)
  assert.doesNotMatch(h.text(), /점수|정답 수|오답 수|정답률|%/)
  h.click('문항 다시 보기')
  assert.ok(optionNodes(h).every(n => n.type === 'div'))
  assert.equal(optionNodes(h).length, 4)
  assert.ok(optionNodes(harness()).every(n => n.type === 'button' && !n.props['aria-pressed']), '새 진입은 미응답 상태')
})
