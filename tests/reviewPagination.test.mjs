import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsx from 'react/jsx-runtime'
import ts from 'typescript'

const row = { id: 54, title: '공개 세트', ownerName: '교수', questionCount: 2, updatedAt: '2026-11-10T00:00:00Z' }
const pageResponse = (page, totalPages, content = [row]) => ({
  page, size: 20, totalPages, totalElements: totalPages === 0 ? 0 : (totalPages - 1) * 20 + 1, content,
})

// 실제 목록 컴포넌트와 실제 조회 훅을 함께 실행한다. 네트워크 응답만 제어한다.
function harness(respond) {
  let cursor = 0
  let effects = []
  const cells = []
  const requests = []
  const frames = []
  const react = {
    useState(initial) {
      const i = cursor++
      cells[i] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [cells[i].value, value => { cells[i].value = typeof value === 'function' ? value(cells[i].value) : value }]
    },
    useCallback(callback, deps) {
      const i = cursor++
      if (!cells[i] || deps.some((dep, j) => dep !== cells[i].deps[j])) cells[i] = { value: callback, deps }
      return cells[i].value
    },
    useEffect(effect, deps) {
      const i = cursor++
      if (!cells[i] || deps.some((dep, j) => dep !== cells[i].deps[j])) {
        cells[i]?.cleanup?.()
        cells[i] = { deps }
        effects.push(() => { cells[i].cleanup = effect() })
      }
    },
  }
  function load(file, dependencies) {
    const source = readFileSync(new URL(`../src/features/${file}`, import.meta.url), 'utf8')
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
    const exports = {}
    runInNewContext(outputText, { exports, Error, require(id) {
      assert.ok(id in dependencies, `Unexpected dependency: ${id}`)
      return dependencies[id]
    } })
    return exports
  }
  const resource = load('review/useReviewResource.ts', {
    react, '../questionset/api': { toQuestionSetApiError: () => ({ code: 'NETWORK_ERROR', message: '연결 실패' }) },
  })
  const { default: List } = load('student/components/StudentReviewSetList.tsx', {
    react, 'react/jsx-runtime': jsx, 'react-router-dom': { Link: 'a' },
    '../../../assets/student/book.svg': 'book.svg', './StudentReviewSetList.css': {},
    '../../review/useReviewResource': resource,
    '../../review/api': { getPublicQuestionSets: async page => { requests.push(page); return respond(page, requests.length) } },
  })
  let tree
  function render() {
    cursor = 0; effects = []
    tree = List()
    frames.push(content(tree))
    effects.forEach(effect => effect())
    return tree
  }
  render()
  return { requests, frames,
    async settle() { for (let i = 0; i < 8; i++) { await new Promise(setImmediate); render() } return tree },
    click(label) {
      const button = nodes(tree).find(node => node.type === 'button' && content(node) === label)
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
const pageLabel = tree => content(nodes(tree).find(node => node.props?.['aria-live'] === 'polite'))

test('정상 목록 페이지 이동은 요청 페이지를 유지하고 중복 재조회하지 않는다', async () => {
  const h = harness(page => pageResponse(page, 2))
  assert.equal(pageLabel(await h.settle()), '1 / 2')
  h.click('다음')
  assert.equal(pageLabel(await h.settle()), '2 / 2')
  h.click('이전')
  assert.equal(pageLabel(await h.settle()), '1 / 2')
  assert.deepEqual(h.requests, [0, 1, 0])
})

test('2페이지 조회 중 범위가 1페이지로 줄면 마지막 유효 페이지로 한 번 보정한다', async () => {
  const h = harness((page, call) => pageResponse(page, call === 1 ? 2 : 1, page === 1 ? [] : [row]))
  await h.settle(); h.click('다음')
  const tree = await h.settle()
  assert.deepEqual(h.requests, [0, 1, 0])
  assert.equal(pageLabel(tree), '1 / 1')
  assert.ok(content(tree).includes(row.title))
  assert.ok(!h.frames.some(frame => frame.includes('2 / 1')))
  assert.ok(!h.frames.some(frame => frame.includes('공개된 문제 세트가 없습니다.')))
})

test('목록 전체가 사라지면 0페이지로 보정 후 빈 목록을 표시하고 재조회 루프를 만들지 않는다', async () => {
  const h = harness((page, call) => call === 1 ? pageResponse(page, 2) : pageResponse(page, 0, []))
  await h.settle(); h.click('다음')
  const tree = await h.settle()
  assert.deepEqual(h.requests, [0, 1, 0])
  assert.equal(pageLabel(tree), '1 / 1')
  assert.ok(content(tree).includes('공개된 문제 세트가 없습니다.'))
  await h.settle()
  assert.deepEqual(h.requests, [0, 1, 0])
})

test('전체 항목이 남아 있는 빈 페이지를 전체 빈 목록과 구분한다', async () => {
  const h = harness(page => pageResponse(page, 2, []))
  const tree = await h.settle()
  assert.ok(content(tree).includes('이 페이지에 표시할 문제 세트가 없습니다.'))
  assert.ok(!content(tree).includes('공개된 문제 세트가 없습니다.'))
  assert.deepEqual(h.requests, [0])
})

test('실패 재시도에서 페이지 범위가 줄어도 보정하고 정상 목록을 복원한다', async () => {
  const h = harness((page, call) => {
    if (call === 2) throw new Error('조회 실패')
    return pageResponse(page, call === 1 ? 2 : 1, page === 1 ? [] : [row])
  })
  await h.settle(); h.click('다음')
  assert.ok(content(await h.settle()).includes('다시 시도'))
  h.click('다시 시도')
  assert.equal(pageLabel(await h.settle()), '1 / 1')
  assert.deepEqual(h.requests, [0, 1, 1, 0])
})
