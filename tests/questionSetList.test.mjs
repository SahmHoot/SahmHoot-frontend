import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const row = { id: 63, title: '서버 세트', visibility: 'PRIVATE', questionCount: 3, used: false, updatedAt: '2026-11-07T00:00:00Z' }
const failure = (status, code, message = '서버 오류') => ({ status, code, message })
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// 기존 Node 테스트 방식으로 훅을 실행하고 API 경계의 요청·응답을 제어한다.
function harness(client = {}) {
  const slots = []
  let index = 0
  let effects = []
  let value
  let reads = 0
  const deletes = []
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
    useCallback(callback, deps) {
      const slot = index++
      if (!slots[slot] || deps.some((dep, i) => dep !== slots[slot].deps[i])) slots[slot] = { callback, deps }
      return slots[slot].callback
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
  const api = {
    getMyQuestionSets: async () => { reads++; return client.getMyQuestionSets ? client.getMyQuestionSets(reads) : [row] },
    deleteQuestionSet: async (id) => { deletes.push(id); return client.deleteQuestionSet?.(id) },
    toQuestionSetApiError: (error) => ({ status: error.status ?? 0, code: error.code ?? 'NETWORK_ERROR', message: error.message ?? '서버 연결 실패' }),
  }
  const source = readFileSync(new URL('../src/features/questionset/useQuestionSetList.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const exports = {}
  runInNewContext(outputText, { exports, require: (id) => {
    if (id === 'react') return react
    if (id === './api') return api
    throw new Error(`Unexpected dependency: ${id}`)
  } })
  const render = () => {
    index = 0; effects = []
    value = exports.useQuestionSetList()
    effects.forEach((effect) => effect())
    return value
  }
  render()
  return { render, deletes, get reads() { return reads },
    openDelete() { render().setDeleting(row); return render() },
    unmount() { slots.forEach((slot) => slot.cleanup?.()) },
    async settle() { for (let i = 0; i < 3; i++) { await new Promise(setImmediate); render() } return value },
  }
}

test('DELETE 성공은 항목을 제거하고 불필요한 GET·자동 DELETE를 추가하지 않는다', async () => {
  const list = harness()
  await list.settle()
  await list.openDelete().confirmDelete()
  assert.equal(list.render().sets.length, 0)
  assert.equal(list.render().deleting, null)
  assert.equal(list.render().deletePending, false)
  assert.equal(list.reads, 1)
  assert.deepEqual(list.deletes, [63])
})

test('DELETE 응답 유실 뒤 서버 목록에서 사라진 항목만 재조회 결과로 제거한다', async () => {
  let deleted = false
  const list = harness({ getMyQuestionSets: async () => deleted ? [] : [row],
    deleteQuestionSet: async () => { deleted = true; throw failure(0, 'NETWORK_ERROR') } })
  await list.settle()
  await list.openDelete().confirmDelete()
  assert.equal(list.render().sets.length, 0)
  assert.equal(list.render().loadError, '')
  assert.equal(list.reads, 2)
  assert.deepEqual(list.deletes, [63])
})

test('응답 유실 뒤 서버에 항목이 남아 있으면 임의로 제거하지 않는다', async () => {
  const list = harness({ deleteQuestionSet: async () => { throw failure(0, 'NETWORK_ERROR') } })
  await list.settle()
  await list.openDelete().confirmDelete()
  assert.equal(list.render().sets[0].id, 63)
  assert.match(list.render().deleteError, /서버 목록/)
  assert.equal(list.reads, 2)
  assert.deepEqual(list.deletes, [63])
})

test('재조회 실패는 기존 데이터를 보존하고 재시도는 GET만 실행한다', async () => {
  const list = harness({ getMyQuestionSets: async (reads) => {
    if (reads === 2) throw failure(0, 'NETWORK_ERROR', '재조회 실패')
    return reads === 1 ? [row] : []
  }, deleteQuestionSet: async () => { throw failure(0, 'NETWORK_ERROR') } })
  await list.settle()
  await list.openDelete().confirmDelete()
  let state = list.render()
  assert.equal(state.sets.length, 1)
  assert.match(state.loadError, /삭제 여부를 확인하지 못했습니다/)
  assert.equal(state.deleting, null)
  // 오래된 이벤트 핸들러로 삭제를 다시 시도해도 재동기화 전에는 차단한다.
  await list.openDelete().confirmDelete()
  assert.deepEqual(list.deletes, [63])
  await state.reload()
  state = list.render()
  assert.equal(state.sets.length, 0)
  assert.equal(state.loadError, '')
  assert.equal(list.reads, 3)
  assert.deepEqual(list.deletes, [63])
})

test('404 QUESTION_SET_NOT_FOUND는 GET으로 동기화하며 DELETE를 재전송하지 않는다', async () => {
  const list = harness({ getMyQuestionSets: async (reads) => reads === 1 ? [row] : [],
    deleteQuestionSet: async () => { throw failure(404, 'QUESTION_SET_NOT_FOUND') } })
  await list.settle()
  await list.openDelete().confirmDelete()
  assert.equal(list.render().sets.length, 0)
  assert.equal(list.reads, 2)
  assert.deepEqual(list.deletes, [63])
})

test('409·401·403 안내를 유지하고 목록 재조회나 자동 DELETE를 하지 않는다', async () => {
  for (const [status, code, expected] of [[409, 'QUESTION_SET_IN_USE', /사용된 문제 세트/],
    [401, 'UNAUTHORIZED', /로그인/], [403, 'FORBIDDEN', /권한/]]) {
    const list = harness({ deleteQuestionSet: async () => { throw failure(status, code) } })
    await list.settle()
    await list.openDelete().confirmDelete()
    assert.match(list.render().deleteError, expected)
    assert.equal(list.render().sets.length, 1)
    assert.equal(list.reads, 1)
    assert.deepEqual(list.deletes, [63])
  }
})

test('DELETE와 복구 GET이 모두 끝날 때까지 중복 삭제·사용자 재조회를 차단한다', async () => {
  const deletion = deferred()
  const recovery = deferred()
  const list = harness({ getMyQuestionSets: async (reads) => reads === 1 ? [row] : recovery.promise,
    deleteQuestionSet: () => deletion.promise })
  await list.settle()
  const handler = list.openDelete().confirmDelete
  const deleting = handler()
  await handler()
  await list.render().reload()
  assert.equal(list.reads, 1)
  assert.deepEqual(list.deletes, [63])
  deletion.reject(failure(0, 'NETWORK_ERROR'))
  await list.settle()
  assert.equal(list.render().deletePending, true)
  assert.equal(list.render().loading, true)
  await handler()
  await list.render().reload()
  assert.equal(list.reads, 2)
  assert.deepEqual(list.deletes, [63])
  recovery.resolve([])
  await deleting
  assert.equal(list.render().deletePending, false)
})

test('삭제 전에 시작한 GET이 늦게 성공해도 삭제된 항목을 되살리지 않는다', async () => {
  const oldRead = deferred()
  const list = harness({ getMyQuestionSets: async (reads) => reads === 1 ? [row] : oldRead.promise })
  await list.settle()
  const handler = list.openDelete().confirmDelete
  const refreshing = list.render().reload()
  await handler()
  assert.equal(list.render().sets.length, 0)
  oldRead.resolve([row])
  await refreshing
  assert.equal(list.render().sets.length, 0)
  assert.equal(list.render().loading, false)
})

test('동시에 시작한 GET의 오래된 성공·오류가 최신 목록을 덮어쓰지 않는다', async () => {
  for (const rejectOld of [false, true]) {
    const oldRead = deferred()
    const list = harness({ getMyQuestionSets: async (reads) => reads === 1 ? [row] : reads === 2 ? oldRead.promise : [] })
    await list.settle()
    const first = list.render().reload()
    await list.render().reload()
    if (rejectOld) oldRead.reject(failure(0, 'NETWORK_ERROR'))
    else oldRead.resolve([row])
    await first
    assert.equal(list.render().sets.length, 0)
    assert.equal(list.render().loadError, '')
  }
})

test('삭제 도중 화면을 떠나면 늦은 실패 응답으로 복구 GET을 실행하지 않는다', async () => {
  const deletion = deferred()
  const list = harness({ deleteQuestionSet: () => deletion.promise })
  await list.settle()
  const pending = list.openDelete().confirmDelete()
  list.unmount()
  deletion.reject(failure(0, 'NETWORK_ERROR'))
  await pending
  assert.equal(list.reads, 1)
})
