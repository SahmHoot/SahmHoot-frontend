import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function moduleAt(file, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/review/${file}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(outputText, { exports, Error, require(id) {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return exports
}

const question = (id, orderNo, type = 'MULTIPLE_CHOICE') => ({ id, orderNo, type,
  content: `문제 ${id}`, timeLimitSeconds: 60,
  choices: [{ id: id * 10 + 2, orderNo: 2, content: '오답', isCorrect: false },
    { id: id * 10 + 1, orderNo: 1, content: '정답', isCorrect: true }] })
const detail = { id: 54, title: '공개 세트', visibility: 'PUBLIC', ownerName: '교수',
  description: null, questions: [question(2, 2, 'TRUE_FALSE'), question(1, 1)] }

function apiHarness(response = detail) {
  const requests = []
  const api = moduleAt('api', {
    '../../shared/api/client': { apiClient: { get: async (...args) => {
      requests.push(['GET', ...args]); return { data: response }
    } } },
    '../questionset/api': { getQuestionSet: async id => {
      requests.push(['GET', `/question-sets/${id}`]); return response
    } },
  })
  return { api, requests }
}

test('공개 목록은 지정한 페이지와 size=20으로 GET만 요청한다', async () => {
  const page = { content: [], page: 2, size: 20, totalElements: 0, totalPages: 0 }
  const { api, requests } = apiHarness(page)
  assert.equal(await api.getPublicQuestionSets(2), page)
  assert.equal(JSON.stringify(requests), JSON.stringify([
    ['GET', '/question-sets/public', { params: { page: 2, size: 20 } }],
  ]))
})

test('상세 조회는 기존 API를 재사용하고 문항·선택지 orderNo를 정렬한다', async () => {
  const { api, requests } = apiHarness()
  const data = await api.getReviewSet('54')
  assert.equal(JSON.stringify(data.questions.map(q => q.id)), '[1,2]')
  assert.equal(JSON.stringify(data.questions[0].choices.map(c => c.id)), '[11,12]')
  assert.equal(data.questions[1].type, 'TRUE_FALSE')
  assert.equal(data.questions[0].choices[0].isCorrect, true)
  assert.equal(detail.questions[0].id, 2, '서버 응답 원본을 변형하지 않는다')
  assert.equal(JSON.stringify(requests), '[["GET","/question-sets/54"]]')
})

test('소유자에게 허용된 PRIVATE 상세도 복습에서 차단한다', async () => {
  const { api } = apiHarness({ ...detail, visibility: 'PRIVATE' })
  await assert.rejects(api.getReviewSet('54'), /비공개/)
})

test('잘못된 ID는 HTTP 요청을 보내지 않는다', async () => {
  const { api, requests } = apiHarness()
  for (const id of ['', '0', '-1', '1.5', 'abc', '01', '9007199254740992']) {
    await assert.rejects(api.getReviewSet(id), /주소/)
  }
  assert.equal(requests.length, 0)
})

test('빈 세트는 문제를 임의 생성하지 않는다', async () => {
  const { api } = apiHarness({ ...detail, questions: [] })
  assert.equal((await api.getReviewSet('54')).questions.length, 0)
})

const { reviewResult } = moduleAt('reviewResult')
test('객관식·OX 정답과 오답을 선택지 ID 및 isCorrect로 계산한다', () => {
  assert.equal(JSON.stringify(reviewResult(detail.questions, { 1: 11, 2: 22 })),
    JSON.stringify({ total: 2, correct: 1, wrong: 1, unanswered: 0, rate: 50 }))
  assert.equal(reviewResult(detail.questions, { 1: 11, 2: 21 }).rate, 100)
  assert.equal(reviewResult(detail.questions, { 1: 12, 2: 22 }).rate, 0)
})

test('미응답·빈 세트는 오답에 중복 집계하지 않고 NaN을 만들지 않는다', () => {
  assert.equal(reviewResult(detail.questions, {}).unanswered, 2)
  assert.equal(reviewResult(detail.questions, {}).wrong, 0)
  assert.equal(reviewResult([], {}).rate, 0)
})

function resourceHarness(initialLoad) {
  let cursor = 0
  const slots = []
  let effects = []
  const react = {
    useState(initial) {
      const i = cursor++
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value }]
    },
    useEffect(effect, deps) {
      const i = cursor++
      if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) {
        slots[i]?.cleanup?.()
        slots[i] = { deps }
        effects.push(() => { slots[i].cleanup = effect() })
      }
    },
  }
  const { useReviewResource } = moduleAt('useReviewResource', {
    react, '../questionset/api': { toQuestionSetApiError: e => ({ code: e.code ?? 'NETWORK_ERROR', message: '연결 실패' }) },
  })
  let load = initialLoad
  const render = () => {
    cursor = 0; effects = []
    const value = useReviewResource(load)
    effects.forEach(effect => effect())
    return value
  }
  return { render, change(next) { load = next; return render() },
    unmount() { slots.forEach(slot => slot.cleanup?.()) },
    async settle() { await new Promise(setImmediate); return render() } }
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('조회 중 로딩을 표시하고 성공·빈 목록을 구분한다', async () => {
  const pending = deferred()
  const h = resourceHarness(() => pending.promise)
  assert.equal(h.render().loading, true)
  pending.resolve({ content: [] })
  const value = await h.settle()
  assert.equal(value.loading, false)
  assert.equal(value.data.content.length, 0)
})

for (const [code, message] of [['FORBIDDEN', /비공개/], ['QUESTION_SET_NOT_FOUND', /찾을 수/], ['UNAUTHORIZED', /로그인/], ['NETWORK_ERROR', /연결 실패/]]) {
  test(`${code} 안내와 재시도 후 복구`, async () => {
    let fail = true
    const h = resourceHarness(async () => { if (fail) throw { code }; return detail })
    h.render()
    const failed = await h.settle()
    assert.match(failed.error, message)
    fail = false
    failed.retry()
    assert.equal(h.render().loading, true)
    assert.equal((await h.settle()).data, detail)
  })
}

test('페이지·ID 변경 후 이전 요청의 늦은 응답은 반영하지 않는다', async () => {
  const old = deferred()
  const h = resourceHarness(() => old.promise)
  h.render()
  h.change(async () => '현재 세트')
  await h.settle()
  old.resolve('이전 세트')
  assert.equal((await h.settle()).data, '현재 세트')
  assert.equal(h.change(async () => '다음 세트').data, undefined)
})

test('화면을 떠난 뒤 응답은 버리고 다시 진입하면 새로 조회한다', async () => {
  const pending = deferred()
  const h = resourceHarness(() => pending.promise)
  h.render(); h.unmount(); pending.resolve(detail)
  assert.equal((await h.settle()).data, undefined)
  const fresh = resourceHarness(async () => detail)
  assert.equal(fresh.render().loading, true)
  assert.equal((await fresh.settle()).data, detail)
})
