import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/${path}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const exports = {}
  runInNewContext(outputText, { exports, structuredClone, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return exports
}
const adapter = load('questionset/roomQuestionSet')
const plain = (value) => JSON.parse(JSON.stringify(value))
const choices = [
  { id: 92, orderNo: 2, content: 'X', isCorrect: true },
  { id: 91, orderNo: 1, content: 'O', isCorrect: false },
]
const question = (id, orderNo, timeLimitSeconds) => ({ id, orderNo, timeLimitSeconds, type: 'TRUE_FALSE', content: `문항 ${id}`, choices })
const detail = () => ({ id: 63, title: '서버 세트', description: null, visibility: 'PRIVATE', ownerName: '교수',
  questions: [question(22, 2, 300), question(11, 1, 10)] })
const summaries = [{ id: 63, title: '서버 세트', questionCount: 2, visibility: 'PRIVATE', used: false, updatedAt: '2026-11-07T00:00:00Z' }]

test('서버 ID·선택지 ID·정답·순서·문항별 시간을 손실 없이 변환하고 원본은 변경하지 않는다', () => {
  const source = detail()
  const before = structuredClone(source)
  const set = adapter.toRoomQuestionSet(source)
  assert.equal(set.id, 63)
  assert.equal(typeof set.id, 'number')
  assert.equal(set.isPublic, false)
  assert.deepEqual(plain(set.questions.map((q) => [q.id, q.orderNo, q.timeLimitSeconds])), [[11, 1, 10], [22, 2, 300]])
  assert.deepEqual(plain(set.questions[0].options), ['O', 'X'])
  assert.deepEqual(plain(set.questions[0].choices.map((choice) => choice.id)), [91, 92])
  assert.equal(set.questions[0].answer, 1)
  assert.deepEqual(source, before)
  set.questions[0].choices[0].content = '수정'
  assert.equal(source.questions[0].choices[1].content, 'O')
  assert.equal(adapter.toRoomQuestionSet({ ...detail(), visibility: 'PUBLIC' }).isPublic, true)
})

test('4지선다도 서버 orderNo 순서와 정답 인덱스를 유지한다', () => {
  const values = [4, 2, 1, 3].map((n) => ({ id: n * 100, orderNo: n, content: String(n), isCorrect: n === 3 }))
  const set = adapter.toRoomQuestionSet({ ...detail(), questions: [{ ...question(1, 1, 60), type: 'MULTIPLE_CHOICE', choices: values }] })
  assert.deepEqual(plain(set.questions[0].options), ['1', '2', '3', '4'])
  assert.equal(set.questions[0].answer, 2)
})

test('빈 상세·잘못된 선택지/정답/제한시간으로 퀴즈를 시작하지 않는다', () => {
  assert.throws(() => adapter.toRoomQuestionSet({ ...detail(), questions: [] }), adapter.RoomQuestionSetError)
  for (const patch of [{ choices: [] }, { choices: choices.map((c) => ({ ...c, isCorrect: false })) },
    { choices: choices.map((c) => ({ ...c, isCorrect: true })) },
    { choices: choices.map((c) => ({ ...c, content: 'O' })) }, { timeLimitSeconds: 9 }, { timeLimitSeconds: 301 }]) {
    assert.throws(() => adapter.toRoomQuestionSet({ ...detail(), questions: [{ ...question(1, 1, 60), ...patch }] }), adapter.RoomQuestionSetError)
  }
})

function harness(client) {
  const slots = []
  let index = 0
  let effects = []
  let value
  const selected = []
  const react = {
    useState(initial) {
      const slot = index++
      if (!slots[slot]) slots[slot] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[slot].value, (next) => { slots[slot].value = typeof next === 'function' ? next(slots[slot].value) : next }]
    },
    useRef(initial) {
      const slot = index++
      if (!slots[slot]) slots[slot] = { current: initial }
      return slots[slot]
    },
    useEffect(effect, deps) {
      const slot = index++
      if (!slots[slot] || deps.some((dep, i) => dep !== slots[slot].deps[i])) {
        slots[slot]?.cleanup?.()
        slots[slot] = { deps }
        effects.push(() => { slots[slot].cleanup = effect() })
      }
    },
  }
  const { useRoomQuestionSets } = load('questionset/useRoomQuestionSets', {
    react, './roomQuestionSet': adapter,
    './api': { ...client, toQuestionSetApiError: (error) => ({ status: error.status ?? 0, code: error.code ?? 'NETWORK_ERROR', message: error.message }) },
  })
  const render = () => {
    index = 0; effects = []
    value = useRoomQuestionSets((set) => selected.push(set))
    effects.forEach((effect) => effect())
    return value
  }
  render()
  return { render, selected, unmount: () => slots.forEach((slot) => slot.cleanup?.()),
    async settle() { for (let i = 0; i < 3; i++) { await new Promise(setImmediate); render() } return value } }
}

test('선택 창 재개방·새로고침마다 최신 mine 목록을 조회하고 목업으로 대체하지 않는다', async () => {
  let reads = 0
  const client = { getMyQuestionSets: async () => { reads++; return reads === 1 ? summaries : [] }, getQuestionSet: async () => detail() }
  const first = harness(client)
  let state = await first.settle()
  assert.equal(state.sets.length, 1)
  state.reload()
  state = await first.settle()
  assert.equal(state.sets.length, 0)
  first.unmount()
  const reopened = harness(client)
  await reopened.settle()
  assert.equal(reads, 3)
})

test('목록 실패·권한 오류 후 재시도로 회복하고 소유 목록에 없는 ID를 요청하지 않는다', async () => {
  let fail = true
  let details = 0
  const client = { getMyQuestionSets: async () => { if (fail) throw { status: 403, code: 'FORBIDDEN' }; return summaries },
    getQuestionSet: async () => { details++; return detail() } }
  const picker = harness(client)
  let state = await picker.settle()
  assert.equal(state.sets.length, 0)
  assert.match(state.listError, /권한/)
  fail = false
  state.reload()
  state = await picker.settle()
  await state.select(999)
  assert.equal(details, 0)
  await state.select(63)
  assert.equal(picker.selected[0].id, 63)
})

test('상세 실패는 시작하지 않고 재시도하며 401·403·404를 안내한다', async () => {
  for (const [status, code, expected] of [[401, 'UNAUTHORIZED', /로그인/], [403, 'FORBIDDEN', /권한/], [404, 'QUESTION_SET_NOT_FOUND', /찾을 수 없습니다/]]) {
    let fail = true
    const picker = harness({ getMyQuestionSets: async () => summaries,
      getQuestionSet: async () => { if (fail) throw { status, code }; return detail() } })
    let state = await picker.settle()
    await state.select(63)
    state = picker.render()
    assert.match(state.detailError, expected)
    assert.equal(picker.selected.length, 0)
    assert.equal(state.selecting, false)
    fail = false
    await state.select(63)
    assert.equal(picker.selected.length, 1)
  }
})

test('중복 선택을 차단하고 창을 닫은 뒤 도착한 상세 응답으로 시작하지 않는다', async () => {
  let finish
  let requests = 0
  const picker = harness({ getMyQuestionSets: async () => summaries,
    getQuestionSet: () => { requests++; return new Promise((resolve) => { finish = resolve }) } })
  const state = await picker.settle()
  const selecting = state.select(63)
  await state.select(63)
  assert.equal(requests, 1)
  picker.unmount()
  finish(detail())
  await selecting
  assert.equal(picker.selected.length, 0)
})

test('요약에는 문항이 있어도 상세가 빈 세트이면 시작하지 않는다', async () => {
  const picker = harness({ getMyQuestionSets: async () => summaries, getQuestionSet: async () => ({ ...detail(), questions: [] }) })
  const state = await picker.settle()
  await state.select(63)
  assert.equal(picker.selected.length, 0)
  assert.match(picker.render().detailError, /문항이 없습니다/)
})
