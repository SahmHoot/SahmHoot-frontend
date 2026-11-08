import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Node의 내장 테스트 러너와 기존 TypeScript만 사용한다. 앱 설정/의존성 변경 없음.
function load(name, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(`../src/features/questionset/${name}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const exports = {}
  runInNewContext(outputText, { exports, crypto: globalThis.crypto, structuredClone, ...globals, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return exports
}
const model = load('editorDraft')
const { saveEditor } = load('saveEditor', { './editorDraft': model })
const recovery = load('editorRecovery', { './editorDraft': model })
const plain = (value) => JSON.parse(JSON.stringify(value))
const question = (id) => ({ ...model.newQuestion(), serverId: id, prompt: '문제', type: 'ox', options: ['O', 'X'] })
const draft = (questions = [question()]) => ({ name: '세트', description: '', isPublic: false, questions })
function fakeApi() {
  const calls = []
  let id = 100
  const client = Object.fromEntries(['createQuestionSet', 'updateQuestionSet', 'deleteQuestion', 'addQuestion', 'updateQuestion', 'reorderQuestions'].map((method) => [method, async (...args) => {
    calls.push([method, ...plain(args)])
    return { id: method === 'updateQuestion' ? args[1] : ++id }
  }]))
  client.getMyQuestionSets = async () => []
  return { client, calls }
}

test('서버 계약: 제목, 문항 내용, 시간, 선택지, 단일 정답, OX 검증', () => {
  assert.equal(model.validateDraft(draft()), null)
  for (const name of ['', ' '.repeat(3), '가'.repeat(51)]) assert(model.validateDraft({ ...draft(), name }))
  assert.equal(model.validateDraft({ ...draft(), name: '가'.repeat(50) }), null)
  for (const seconds of [9, 301, 10.5, NaN]) assert(model.validateDraft(draft([{ ...question(), seconds }])))
  for (const seconds of [10, 300]) assert.equal(model.validateDraft(draft([{ ...question(), seconds }])), null)
  for (const patch of [{ prompt: '' }, { prompt: 'x'.repeat(501) }, { options: ['O'] }, { options: ['O', 'O'] }, { answer: -1 }, { answer: 2 }, { answer: 0.5 }]) {
    assert(model.validateDraft(draft([{ ...question(), ...patch }])))
  }
  assert(model.validateDraft(draft([{ ...question(), type: 'multiple', options: ['a', 'b', 'c'] }])))
  assert.equal(model.validateDraft(draft([{ ...question(), type: 'multiple', options: ['a', 'b', 'c', 'd'] }])), null)
  assert.equal(model.questionRequest(question()).choices.filter((choice) => choice.isCorrect).length, 1)
})

test('서버 순서와 숫자 ID를 화면용 임시 키와 구분한다', () => {
  assert.equal(model.fromDetail({ title: '빈 세트', description: null, visibility: 'PRIVATE', questions: [] }).questions.length, 0)
  const result = model.fromDetail({ title: '기존', description: null, visibility: 'PUBLIC', questions: [
    { id: 2, orderNo: 2, type: 'TRUE_FALSE', content: '둘', timeLimitSeconds: 45, choices: [{ orderNo: 2, content: 'X', isCorrect: true }, { orderNo: 1, content: 'O', isCorrect: false }] },
    { id: 1, orderNo: 1, type: 'TRUE_FALSE', content: '하나', timeLimitSeconds: 10, choices: [] },
  ] })
  assert.deepEqual(plain(result.questions.map((item) => item.serverId)), [1, 2])
  assert.equal(result.questions[1].answer, 1)
  assert.equal(result.questions[1].seconds, 45)
  assert.match(model.newQuestion().id, /^temp:/)
  assert.equal(model.newQuestion().serverId, undefined)
})

test('생성 → 문항 POST → 숫자 ID 전체 순서 저장', async () => {
  const { client, calls } = fakeApi()
  const checkpoint = { questionIds: [], creating: false }
  await saveEditor(draft([question(), question()]), checkpoint, client)
  assert.deepEqual(calls.map(([method]) => method), ['createQuestionSet', 'addQuestion', 'addQuestion', 'reorderQuestions'])
  assert.deepEqual(calls.at(-1), ['reorderQuestions', 101, { questionIds: [102, 103] }])
  assert.equal(checkpoint.setId, 101)
  assert.equal(checkpoint.creating, false)
})

test('기존 문항 DELETE/PUT와 새 문항 POST 후 원하는 순서를 전송한다', async () => {
  const { client, calls } = fakeApi()
  await saveEditor(draft([question(20), question(), question(10)]), { setId: 1, questionIds: [10, 20, 30], creating: false }, client)
  assert.deepEqual(calls.map(([method]) => method), ['updateQuestionSet', 'deleteQuestion', 'updateQuestion', 'addQuestion', 'updateQuestion', 'reorderQuestions'])
  assert.deepEqual(calls[1], ['deleteQuestion', 1, 30])
  assert.deepEqual(calls.at(-1), ['reorderQuestions', 1, { questionIds: [20, 103, 10] }])
})

test('생성 응답 유실 시 같은 체크포인트로 POST를 재전송하지 않는다', async () => {
  const { client, calls } = fakeApi()
  client.createQuestionSet = async () => { calls.push(['createQuestionSet']); throw new Error('응답 유실') }
  const checkpoint = { questionIds: [], creating: false }
  await assert.rejects(saveEditor(draft(), checkpoint, client))
  await assert.rejects(saveEditor(draft(), checkpoint, client))
  assert.equal(calls.length, 1)
})

test('부분 성공 후 재조회한 숫자 ID로 재시도하면 세트/문항을 중복 생성하지 않는다', async () => {
  const { client, calls } = fakeApi()
  client.reorderQuestions = async () => { throw new Error('순서 저장 실패') }
  const checkpoint = { questionIds: [], creating: false }
  await assert.rejects(saveEditor(draft(), checkpoint, client))
  assert.equal(checkpoint.setId, 101)
  // 편집기 훅이 GET으로 재동기화한 상태를 재현한다.
  checkpoint.questionIds = [102]
  client.reorderQuestions = async (...args) => { calls.push(['reorderQuestions', ...plain(args)]) }
  await saveEditor(draft([question(102)]), checkpoint, client)
  assert.equal(calls.filter(([method]) => method === 'createQuestionSet').length, 1)
  assert.equal(calls.filter(([method]) => method === 'addQuestion').length, 1)
  assert.equal(calls.filter(([method]) => method === 'updateQuestion').length, 1)
})

test('중간 요청 실패 시 후속 요청을 실행하지 않는다', async () => {
  const { client, calls } = fakeApi()
  client.deleteQuestion = async () => { throw new Error('삭제 실패') }
  await assert.rejects(saveEditor(draft([question(1)]), { setId: 1, questionIds: [1, 2], creating: false }, client))
  assert.deepEqual(calls.map(([method]) => method), ['updateQuestionSet'])
})

test('공개 신규 생성은 PRIVATE로 시작하고 순서 저장 후 visibility만 PATCH한다', async () => {
  const { client, calls } = fakeApi()
  await saveEditor({ ...draft(), isPublic: true }, { questionIds: [], creating: false }, client)
  assert.equal(calls[0][1].visibility, 'PRIVATE')
  assert.equal(calls.at(-2)[0], 'reorderQuestions')
  assert.deepEqual(calls.at(-1), ['updateQuestionSet', 101, { visibility: 'PUBLIC' }])
})

test('PRIVATE→PUBLIC 메타데이터 PATCH는 visibility를 생략하며 중간 실패하면 공개하지 않는다', async () => {
  const { client, calls } = fakeApi()
  client.reorderQuestions = async () => { throw new Error('순서 실패') }
  await assert.rejects(saveEditor({ ...draft(), isPublic: true }, { setId: 1, questionIds: [], creating: false, visibility: 'PRIVATE' }, client))
  assert.deepEqual(calls[0], ['updateQuestionSet', 1, { title: '세트', description: null }])
  assert.equal(calls.filter(([method]) => method === 'updateQuestionSet').length, 1)
})

test('이미 PUBLIC인 세트는 불필요한 공개 전환을 하지 않고 PRIVATE 전환은 먼저 적용한다', async () => {
  const first = fakeApi()
  await saveEditor({ ...draft(), isPublic: true }, { setId: 1, questionIds: [], creating: false, visibility: 'PUBLIC' }, first.client)
  assert.equal(first.calls.filter(([method]) => method === 'updateQuestionSet').length, 1)
  const second = fakeApi()
  await saveEditor(draft([]), { setId: 1, questionIds: [], creating: false, visibility: 'PUBLIC' }, second.client)
  assert.equal(second.calls[0][2].visibility, 'PRIVATE')
})

test('초안 보존은 원본과 독립적이며 성공한 새 문항은 숫자 ID로 복원한다', () => {
  const submitted = draft([question(10), question(), question()])
  const savedKey = submitted.questions[1].id
  const backup = recovery.preserveDraft(submitted, [10, 20], { setId: 1, creating: false, createdIds: { [savedKey]: 30 } })
  submitted.name = '나중 변경'
  const server = draft([{ ...question(10), prompt: '서버의 이전 내용' }, question(30), question(20), question(40)])
  const plan = recovery.planRecovery(backup, server)
  assert.equal(backup.draft.name, '세트')
  assert.deepEqual(plain(plan.statuses), ['unsaved', 'saved', 'unsaved'])
  assert.deepEqual(plain(plan.restored.questions.map((q) => q.serverId ?? 'temp')), [10, 30, 'temp', 40])
  assert.equal(plan.restored.questions[0].prompt, '문제')
  assert.equal(plan.restored.questions[1].id, 'server:30')
  assert.equal(server.questions[0].prompt, '서버의 이전 내용')
})

test('문항 생성 응답 유실과 서버에서 사라진 문항은 자동 병합하지 않는다', () => {
  const submitted = draft()
  const backup = recovery.preserveDraft(submitted, [], { setId: 1, creating: false, pendingQuestionId: submitted.questions[0].id })
  // 내용이 같아도 ID를 추측하여 연결하지 않는다.
  assert.equal(recovery.planRecovery(backup, draft([question(30)])).restored, null)
  const missing = recovery.preserveDraft(draft([question(10)]), [10], { setId: 1, creating: false })
  assert.equal(recovery.planRecovery(missing, draft([])).restored, null)
})

test('문항 생성 응답 유실 시 재조회 전 saveEditor가 후속 POST를 막는다', async () => {
  const { client, calls } = fakeApi()
  client.addQuestion = async () => { calls.push(['addQuestion']); throw new Error('응답 유실') }
  const checkpoint = { setId: 1, questionIds: [], creating: false }
  await assert.rejects(saveEditor(draft(), checkpoint, client))
  const count = calls.length
  await assert.rejects(saveEditor(draft(), checkpoint, client))
  assert.equal(calls.length, count)
})

// 기존 의존성만으로 실제 편집기 훅을 실행한다. API·라우터 경계만 대체한다.
let harnessUserId = 63000
function editorHarness(routeId, client, state = null, userId = ++harnessUserId) {
  const slots = []
  let index = 0
  let effects = []
  let value
  const navigations = []
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
  let finished = 0
  const { useQuestionSetEditor } = load('useQuestionSetEditor', {
    react,
    '../auth/AuthProvider': { useAuth: () => ({ user: { id: userId } }) },
    'react-router-dom': { useLocation: () => ({ state }), useNavigate: () => (path, options) => navigations.push({ path, options }) },
    './api': Object.assign(client, { toQuestionSetApiError: (error) => ({ status: error.status ?? 0, message: error.message, code: 'TEST' }) }),
    './editorDraft': model, './saveEditor': { saveEditor }, './editorRecovery': recovery,
    './editorNavigation': { lockEditorNavigation: () => async () => {} },
  })
  const render = () => {
    index = 0
    effects = []
    value = useQuestionSetEditor(routeId, () => { finished++ })
    effects.forEach((effect) => effect())
    return value
  }
  render()
  return { render, navigations, get finished() { return finished },
    unmount() { slots.forEach((slot) => slot.cleanup?.()) },
    async settle() { for (let i = 0; i < 3; i++) { await new Promise(setImmediate); render() } return value } }
}
const detailOf = (questions = []) => ({ id: 101, title: '세트', description: null, visibility: 'PRIVATE', questions: questions.map((q, index) => ({
  ...model.questionRequest(q), id: q.serverId, orderNo: index + 1,
  choices: model.questionRequest(q).choices.map((choice, choiceIndex) => ({ ...choice, id: choiceIndex + 1, orderNo: choiceIndex + 1 })),
})) })

test('실제 훅: 후속 실패 후 신규 ID 주소로 이동하고 재마운트·복원·재저장 시 중복 생성하지 않는다', async () => {
  const { client, calls } = fakeApi()
  client.getQuestionSet = async () => detailOf([question(102)])
  client.reorderQuestions = async () => { throw new Error('순서 실패') }
  const initial = editorHarness('new', client)
  initial.render().setDraft(draft())
  await initial.render().save()
  assert.equal(initial.finished, 0)
  assert.equal(initial.navigations[0].path, '/professor/sets/101')
  assert.equal(initial.navigations[0].options.replace, true)
  const next = editorHarness('101', client, initial.navigations[0].options.state)
  let state = await next.settle()
  assert(state.recovery)
  assert.equal(state.recoveryResolved, false)
  const count = calls.length
  await state.save()
  assert.equal(calls.length, count)
  state.restore()
  state = next.render()
  assert.equal(state.draft.questions[0].serverId, 102)
  client.reorderQuestions = async () => {}
  await state.save()
  assert.equal(next.finished, 1)
  assert.equal(calls.filter(([method]) => method === 'createQuestionSet').length, 1)
  assert.equal(calls.filter(([method]) => method === 'addQuestion').length, 1)
})

test('실제 훅: 복구 GET 실패에도 초안을 보존하고 재조회 후 명시적으로 복원한다', async () => {
  const { client } = fakeApi()
  let failRead = false
  client.getQuestionSet = async () => { if (failRead) throw new Error('조회 실패'); return detailOf([question(10)]) }
  client.updateQuestionSet = async () => { failRead = true; throw new Error('메타데이터 실패') }
  const editor = editorHarness('101', client)
  let state = await editor.settle()
  state.setDraft({ ...draft([question(10)]), name: '보존할 제목' })
  await editor.render().save()
  state = editor.render()
  assert.equal(state.needsReload, true)
  assert.equal(state.recovery.draft.name, '보존할 제목')
  failRead = false
  state.reload()
  state = await editor.settle()
  assert.equal(state.draft.name, '세트')
  state.restore()
  assert.equal(editor.render().draft.name, '보존할 제목')
})

test('실제 훅: 생성 결과 불명은 초안과 함께 route state에 보존하고 재마운트 후에도 재POST하지 않는다', async () => {
  const { client, calls } = fakeApi()
  client.createQuestionSet = async () => { calls.push(['createQuestionSet']); throw new Error('응답 유실') }
  const editor = editorHarness('new', client)
  editor.render().setDraft(draft())
  await editor.render().save()
  assert.equal(editor.render().creationUnknown, true)
  const next = editorHarness('new', client, editor.navigations[0].options.state)
  assert.equal(next.render().creationUnknown, true)
  assert.equal(next.render().recovery.draft.name, '세트')
  await next.render().save()
  assert.equal(calls.length, 1)
})

test('실제 훅: 문항 POST 응답 유실 후 서버와 초안을 구분하고 자동 복원을 막는다', async () => {
  const { client, calls } = fakeApi()
  let committed = false
  client.getQuestionSet = async () => detailOf(committed ? [question(102)] : [])
  client.addQuestion = async () => { committed = true; calls.push(['addQuestion']); throw new Error('응답 유실') }
  const editor = editorHarness('101', client)
  await editor.settle()
  editor.render().setDraft(draft())
  await editor.render().save()
  let state = editor.render()
  assert.equal(recovery.planRecovery(state.recovery, state.serverDraft).restored, null)
  state.restore()
  assert.equal(editor.render().recoveryResolved, false)
  state.useServer()
  state = editor.render()
  assert.equal(state.draft.questions[0].serverId, 102)
  await state.save()
  assert.equal(calls.filter(([method]) => method === 'addQuestion').length, 1)
})

test('실제 훅: 저장 도중 중복 호출을 막고 후속 요청 종료 전에는 신규 주소로 이동하지 않는다', async () => {
  const { client, calls } = fakeApi()
  let rejectOrder
  client.getQuestionSet = async () => detailOf([question(102)])
  client.reorderQuestions = () => new Promise((resolve, reject) => { rejectOrder = reject })
  const editor = editorHarness('new', client)
  editor.render().setDraft(draft())
  const saving = editor.render().save()
  await new Promise(setImmediate)
  const count = calls.length
  await editor.render().save()
  assert.equal(calls.length, count)
  assert.equal(editor.navigations.length, 0)
  rejectOrder(new Error('순서 실패'))
  await saving
  assert.equal(editor.navigations[0].path, '/professor/sets/101')
})

test('실제 훅: 생성이 거절된 문항은 응답 유실과 구분하여 명시적 초안 복원을 허용한다', async () => {
  const { client } = fakeApi()
  client.getQuestionSet = async () => detailOf([])
  client.addQuestion = async () => { throw Object.assign(new Error('검증 실패'), { status: 400 }) }
  const editor = editorHarness('101', client)
  await editor.settle()
  editor.render().setDraft(draft())
  await editor.render().save()
  const state = editor.render()
  assert.equal(state.recovery.uncertainQuestionId, undefined)
  state.restore()
  assert.equal(editor.render().recoveryResolved, true)
  assert.equal(editor.render().draft.questions[0].serverId, undefined)
})

test('저장 중 뒤로가기 popstate를 라우터보다 먼저 막고 되돌림 완료 후 잠금을 해제한다', async () => {
  const listeners = new Map()
  const moves = []
  const fakeWindow = { location: { href: '/professor/sets/new' }, history: {
    state: { idx: 2 }, go: (delta) => moves.push(delta), replaceState() {},
  }, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name) }
  const fakeDocument = { addEventListener() {}, removeEventListener() {} }
  const { lockEditorNavigation } = load('editorNavigation', {}, { window: fakeWindow, document: fakeDocument })
  const unlock = lockEditorNavigation()
  fakeWindow.history.state = { idx: 1 }
  let stopped = false
  listeners.get('popstate')({ stopImmediatePropagation: () => { stopped = true } })
  assert.equal(stopped, true)
  assert.deepEqual(moves, [1])
  let released = false
  const release = unlock().then(() => { released = true })
  await Promise.resolve()
  assert.equal(released, false)
  fakeWindow.history.state = { idx: 2 }
  listeners.get('popstate')({ stopImmediatePropagation() {} })
  await release
  assert.equal(released, true)
  // 사전 등록한 리스너는 남지만, 저장 종료 뒤에는 이동을 가로막지 않는다.
  assert.equal(listeners.size, 1)
  stopped = false
  listeners.get('popstate')({ stopImmediatePropagation: () => { stopped = true } })
  assert.equal(stopped, false)
})

test('401로 언마운트되어도 같은 계정의 재로그인 후 초안을 복원하고 다른 계정에는 노출하지 않는다', async () => {
  const { client, calls } = fakeApi()
  let reads = 0
  client.getQuestionSet = async () => { reads++; return detailOf([question(10)]) }
  const editor = editorHarness('101', client, null, 4401)
  await editor.settle()
  client.updateQuestionSet = async () => {
    calls.push(['updateQuestionSet'])
    editor.unmount()
    throw Object.assign(new Error('로그인 필요'), { status: 401 })
  }
  editor.render().setDraft({ ...draft([question(10)]), name: '401 이전 초안' })
  await editor.render().save()
  assert.equal(reads, 1)
  assert.equal(editor.navigations.length, 0)
  assert.equal(editor.finished, 0)
  assert.equal(calls.length, 1)
  const other = editorHarness('101', client, null, 4402)
  assert.equal((await other.settle()).recovery, null)
  const returned = editorHarness('101', client, null, 4401)
  let state = await returned.settle()
  assert.equal(state.recovery.draft.name, '401 이전 초안')
  await state.save()
  assert.equal(calls.length, 1)
  state.restore()
  state = returned.render()
  assert.equal(state.draft.name, '401 이전 초안')
  client.updateQuestionSet = async () => {}
  await state.save()
  assert.equal(returned.finished, 1)
  assert.equal(recovery.interruptedDraft(4401, '101'), null)
})

test('신규 세트 POST의 401은 생성 불명으로 잠그지 않고 재로그인 후 명시적으로 복원한다', async () => {
  const { client, calls } = fakeApi()
  client.createQuestionSet = async () => {
    calls.push(['createQuestionSet'])
    throw Object.assign(new Error('로그인 필요'), { status: 401 })
  }
  const editor = editorHarness('new', client, null, 4403)
  editor.render().setDraft(draft())
  await editor.render().save()
  const returned = editorHarness('new', client, null, 4403)
  const state = await returned.settle()
  assert.equal(state.creationUnknown, false)
  assert.equal(state.needsReload, false)
  await state.save()
  assert.equal(calls.length, 1)
  state.restore()
  assert.equal(returned.render().draft.name, '세트')
  assert.equal(returned.render().recoveryResolved, true)
  state.useServer()
  assert.equal(recovery.interruptedDraft(4403, 'new'), null)
})

test('신규 세트 부분 저장 뒤 PUT의 401은 기존 숫자 ID로 조회하고 POST를 재실행하지 않는다', async () => {
  const { client, calls } = fakeApi()
  const ids = []
  client.getQuestionSet = async (id) => { ids.push(id); return detailOf([question(102)]) }
  client.reorderQuestions = async () => { throw Object.assign(new Error('로그인 필요'), { status: 401 }) }
  const editor = editorHarness('new', client, null, 4404)
  editor.render().setDraft(draft())
  await editor.render().save()
  assert.equal(ids.length, 0)
  const returned = editorHarness('new', client, null, 4404)
  let state = await returned.settle()
  assert.deepEqual(ids, [101])
  state.restore()
  state = returned.render()
  assert.equal(state.draft.questions[0].serverId, 102)
  client.reorderQuestions = async () => {}
  await state.save()
  assert.equal(calls.filter(([method]) => method === 'createQuestionSet').length, 1)
  assert.equal(calls.filter(([method]) => method === 'addQuestion').length, 1)
})

test('저장 오류 복구 GET의 401도 초안을 보존하고 로그인 이동을 덮어쓰지 않는다', async () => {
  const { client } = fakeApi()
  let failRead = false
  client.getQuestionSet = async () => {
    if (failRead) throw Object.assign(new Error('로그인 필요'), { status: 401 })
    return detailOf([question(10)])
  }
  client.updateQuestionSet = async () => { failRead = true; throw new Error('응답 유실') }
  const editor = editorHarness('101', client, null, 4405)
  await editor.settle()
  editor.render().setDraft({ ...draft([question(10)]), name: '복구 GET 이전 초안' })
  await editor.render().save()
  assert.equal(editor.navigations.length, 0)
  failRead = false
  const returned = editorHarness('101', client, null, 4405)
  const state = await returned.settle()
  assert.equal(state.recovery.draft.name, '복구 GET 이전 초안')
  state.restore()
  assert.equal(returned.render().draft.name, '복구 GET 이전 초안')
})

test('설명은 공백 포함 원문 기준 1000 UTF-16 단위까지 허용하고 그대로 전송한다', async () => {
  for (const description of ['가'.repeat(1000), 'a'.repeat(1000), '😀'.repeat(500), ' '.repeat(1000)]) {
    const value = { ...draft(), description }
    assert.equal(model.validateDraft(value), null)
    assert(model.validateDraft({ ...value, description: description + '가' }))
    const { client, calls } = fakeApi()
    await saveEditor(value, { questionIds: [], creating: false }, client)
    assert.equal(calls[0][1].description, description)
  }
})

for (const status of [400, 405, 429, 500]) test(`세트 POST ${status}: 초안 보존, 목록 왕복, 명시적 복원 후 재시도`, async () => {
  const { client, calls } = fakeApi()
  const create = client.createQuestionSet
  client.createQuestionSet = async () => { calls.push(['failedCreate']); throw Object.assign(new Error('HTTP 실패'), { status }) }
  const userId = ++harnessUserId
  const editor = editorHarness('new', client, null, userId)
  const submitted = { ...draft(), description: '가'.repeat(1000) }
  editor.render().setDraft(submitted)
  await editor.render().save()
  const failed = editor.render()
  assert.equal(failed.creationUnknown, false)
  assert.equal(failed.recovery.draft.description, submitted.description)
  assert.match(failed.error, /HTTP 실패/)
  assert.equal(calls.length, 1)
  // 목록을 방문한 뒤 state 없이 동일 편집기로 돌아온다.
  const returned = editorHarness('new', client, null, userId)
  let state = returned.render()
  assert.equal(state.recovery.draft.description, submitted.description)
  state.restore()
  state = returned.render()
  client.createQuestionSet = create
  client.getQuestionSet = async () => detailOf([question(102)])
  await state.save()
  assert.equal(returned.finished, 1)
  assert.equal(calls.filter(([name]) => name === 'createQuestionSet').length, 1)
})

for (const status of [0, 502, 504]) test(`세트 POST ${status}: 결과 불명은 목록 조회만 허용하고 재POST하지 않는다`, async () => {
  const { client, calls } = fakeApi()
  client.createQuestionSet = async () => { calls.push(['create']); throw Object.assign(new Error('결과 불명'), { status }) }
  const userId = ++harnessUserId
  const editor = editorHarness('new', client, null, userId)
  editor.render().setDraft(draft())
  await editor.render().save()
  let state = editor.render()
  assert.equal(state.creationUnknown, true)
  await state.checkCreation()
  state = editor.render()
  assert.equal(state.creationUnknown, true)
  // 초기 빈 초안을 서버 상태로 오인해 보관 초안을 삭제하거나 복원하지 않는다.
  state.restore()
  state.useServer()
  assert.equal(editor.render().recoveryResolved, false)
  assert.equal(recovery.interruptedDraft(userId, 'new').draft.name, '세트')
  await state.save()
  const returned = editorHarness('new', client, null, userId)
  assert.equal(returned.render().recovery.draft.name, '세트')
  await returned.render().save()
  assert.equal(calls.length, 1)
})

test('세트 POST 500: 커밋 후보가 있으면 자동 연결/재생성하지 않고 사용자가 선택한다', async () => {
  const { client, calls } = fakeApi()
  let committed = false
  client.getMyQuestionSets = async () => committed ? [{ id: 201, title: '세트' }] : []
  client.createQuestionSet = async () => { committed = true; calls.push(['create']); throw Object.assign(new Error('500'), { status: 500 }) }
  const editor = editorHarness('new', client)
  editor.render().setDraft(draft())
  await editor.render().save()
  let state = editor.render()
  assert.equal(state.creationUnknown, true)
  assert.equal(state.creationCandidates[0].id, 201)
  await state.save()
  assert.equal(calls.length, 1)
  state.selectCreatedSet(201)
  assert.equal(editor.navigations.at(-1).path, '/professor/sets/201')
  assert.equal(editor.navigations.at(-1).options.state.questionSetRecovery.draft.name, '세트')
})

test('세트 POST 500: 재조회 실패 후 확인 버튼으로 복구하고 초안을 유지한다', async () => {
  const { client } = fakeApi()
  let reads = 0
  client.getMyQuestionSets = async () => { if (++reads === 2) throw new Error('조회 실패'); return [] }
  client.createQuestionSet = async () => { throw Object.assign(new Error('500'), { status: 500 }) }
  const editor = editorHarness('new', client)
  editor.render().setDraft(draft())
  await editor.render().save()
  assert.equal(editor.render().creationUnknown, true)
  await editor.render().checkCreation()
  assert.equal(editor.render().creationUnknown, false)
  assert.equal(editor.render().draft.name, '세트')
})

for (const committed of [false, true]) test(`문항 POST 500: 커밋 ${committed} 재조회로 확인하며 중복을 방지한다`, async () => {
  const { client, calls } = fakeApi()
  let failed = false
  client.getQuestionSet = async () => detailOf(failed && committed ? [question(202)] : [])
  client.addQuestion = async () => { failed = true; calls.push(['failedQuestion']); throw Object.assign(new Error('500'), { status: 500 }) }
  const editor = editorHarness('101', client)
  await editor.settle()
  editor.render().setDraft(draft())
  await editor.render().save()
  let state = editor.render()
  assert.equal(Boolean(state.recovery.uncertainQuestionId), committed)
  assert.equal(state.recovery.draft.questions[0].prompt, '문제')
  state.restore()
  state = editor.render()
  assert.equal(state.recoveryResolved, !committed)
  if (committed) {
    state.useServer()
    state = editor.render()
    assert.equal(state.draft.questions[0].serverId, 202)
  }
  client.addQuestion = async () => { calls.push(['retryQuestion']); return { id: 203 } }
  client.getQuestionSet = async () => detailOf([question(committed ? 202 : 203)])
  await state.save()
  assert.equal(editor.finished, 1)
  assert.equal(calls.filter(([name]) => name === 'retryQuestion').length, committed ? 0 : 1)
})

for (const status of [0, 502, 504]) test(`문항 POST ${status}: 재조회에 항목이 없어도 결과 불명을 유지한다`, async () => {
  const { client, calls } = fakeApi()
  client.getQuestionSet = async () => detailOf([])
  client.addQuestion = async () => { calls.push(['post']); throw Object.assign(new Error('불명'), { status }) }
  const editor = editorHarness('101', client)
  await editor.settle()
  editor.render().setDraft(draft())
  await editor.render().save()
  const state = editor.render()
  assert(state.recovery.uncertainQuestionId)
  state.restore()
  await editor.render().save()
  assert.equal(calls.filter(([name]) => name === 'post').length, 1)
})

test('1001자 설명은 훅에서도 API 호출 전에 거절하고 입력을 유지한다', async () => {
  const { client, calls } = fakeApi()
  let reads = 0
  client.getMyQuestionSets = async () => { reads++; return [] }
  const editor = editorHarness('new', client)
  editor.render().setDraft({ ...draft(), description: '가'.repeat(1001) })
  await editor.render().save()
  assert.equal(editor.render().draft.description.length, 1001)
  assert.match(editor.render().error, /1000/)
  assert.equal(reads, 0)
  assert.equal(calls.length, 0)
})

test('문항 500 뒤 상세 조회 실패도 나중에 재조회하면 초안을 복원할 수 있다', async () => {
  const { client } = fakeApi()
  let failed = false
  let readFails = true
  client.getQuestionSet = async () => {
    if (failed && readFails) throw new Error('조회 실패')
    return detailOf([])
  }
  client.addQuestion = async () => { failed = true; throw Object.assign(new Error('500'), { status: 500 }) }
  const editor = editorHarness('101', client)
  await editor.settle()
  editor.render().setDraft(draft())
  await editor.render().save()
  assert.equal(editor.render().needsReload, true)
  readFails = false
  editor.render().reload()
  let state = await editor.settle()
  assert.equal(state.recovery.uncertainQuestionId, undefined)
  state.restore()
  assert.equal(editor.render().recoveryResolved, true)
  assert.equal(editor.render().draft.questions[0].prompt, '문제')
})

test('세트 500 검증 GET의 401은 로그인 이동을 덮어쓰지 않고 초안을 보존한다', async () => {
  const { client } = fakeApi()
  const userId = ++harnessUserId
  let reads = 0
  client.getMyQuestionSets = async () => {
    if (++reads > 1) throw Object.assign(new Error('로그인 필요'), { status: 401 })
    return []
  }
  client.createQuestionSet = async () => { throw Object.assign(new Error('500'), { status: 500 }) }
  const editor = editorHarness('new', client, null, userId)
  editor.render().setDraft(draft())
  await editor.render().save()
  assert.equal(editor.navigations.length, 0)
  assert.equal(recovery.interruptedDraft(userId, 'new').draft.name, '세트')
})
