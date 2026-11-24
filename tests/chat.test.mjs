import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import * as jsxRuntime from 'react/jsx-runtime'

function load(file, dependencies = {}, extension = 'ts', globals = {}) {
  const source = readFileSync(new URL(`../src/features/chat/${file}.${extension}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  runInNewContext(outputText, { exports, setTimeout, clearTimeout, ...globals, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`)
    return dependencies[id]
  } })
  return exports
}
const model = load('chatState')
const plain = (value) => JSON.parse(JSON.stringify(value))
const message = (id, overrides = {}) => ({ id, senderParticipantId: 10, nickname: '실제 교수', isOwner: true,
  content: `메시지 ${id}`, parentId: null, parentPreview: null, createdAt: `2026-11-19T00:00:${String(id % 60).padStart(2, '0')}Z`, ...overrides })
const snapshot = (messages = [], blocked = false) => ({ recentMessages: messages, pinnedMessages: [], me: { participantId: 10, chatBlocked: blocked } })
const action = (value, channel = 'chat') => ({ type: 'message', channel, message: { type: 'MESSAGE', sentAt: value.createdAt, ...value } })

test('최신순 스냅샷은 원본 변경 없이 시간순으로 복원하고 실시간 메시지를 뒤에 붙인다', () => {
  const source = snapshot([message(3), message(2), message(1)])
  const state = model.chatReducer(model.initialChat, { type: 'snapshot', state: source })
  assert.deepEqual(plain(state.messages.map(({ id }) => id)), [1, 2, 3])
  assert.deepEqual(source.recentMessages.map(({ id }) => id), [3, 2, 1])
  const next = model.chatReducer(state, action(message(4)))
  assert.deepEqual(plain(next.messages.map(({ id }) => id)), [1, 2, 3, 4])
  assert.equal(next.received, 1)
  assert.equal(model.chatReducer(next, action(message(4))), next)
})

test('도착 순서가 바뀌어도 ID 순서를 유지하고 최근 50건만 보관한다', () => {
  let state = model.chatReducer(model.initialChat, { type: 'snapshot', state: snapshot() })
  for (const id of [2, 1]) state = model.chatReducer(state, action(message(id)))
  assert.deepEqual(plain(state.messages.map(({ id }) => id)), [1, 2])
  for (const id of Array.from({ length: 51 }, (_, index) => index + 3)) state = model.chatReducer(state, action(message(id)))
  assert.equal(state.messages.length, 50)
  assert.equal(state.messages[0].id, 4)
  assert.equal(state.messages.at(-1).id, 53)
})

test('최초 대화는 읽지 않음에서 제외하고 재접속으로 복원한 새 메시지만 한 번 센다', () => {
  let state = model.chatReducer(model.initialChat, { type: 'snapshot', state: snapshot([message(2), message(1)]) })
  assert.equal(state.received, 0)
  state = model.chatReducer(state, action(message(3)))
  state = model.chatReducer(state, { type: 'snapshot', state: snapshot([message(5), message(4), message(3), message(2)]) })
  assert.equal(state.received, 3)
  state = model.chatReducer(state, { type: 'snapshot', state: snapshot([message(5), message(4), message(3), message(2)]) })
  state = model.chatReducer(state, action(message(5)))
  assert.equal(state.received, 3)
  const empty = model.chatReducer(model.initialChat, { type: 'snapshot', state: snapshot() })
  assert.equal(model.chatReducer(empty, { type: 'snapshot', state: snapshot([message(1)]) }).received, 1)
})

test('삭제와 빈 스냅샷 뒤에도 마지막으로 확인한 ID를 보존해 과거 대화를 새 메시지로 세지 않는다', () => {
  let state = model.chatReducer(model.initialChat, { type: 'snapshot', state: snapshot([message(4)]) })
  state = model.chatReducer(state, action({ type: 'MESSAGE_DELETED', messageId: 4 }))
  state = model.chatReducer(state, { type: 'snapshot', state: snapshot() })
  state = model.chatReducer(state, { type: 'snapshot', state: snapshot([message(5), message(3)]) })
  assert.equal(state.received, 1)
  assert.equal(state.latestMessageId, 5)
  assert.equal(model.chatReducer(state, { type: 'reset' }).latestMessageId, 0)
})

test('삭제는 모든 화면에서 메시지와 인용을 지운다', () => {
  const source = snapshot([message(2, { parentId: 1, parentPreview: '지워질 내용' }), message(1)])
  const state = model.chatReducer(model.initialChat, { type: 'snapshot', state: source })
  const next = model.chatReducer(state, action({ type: 'MESSAGE_DELETED', messageId: 1 }))
  assert.equal(next.messages.length, 1)
  assert.equal(next.messages[0].parentPreview, null)
})

test('MY_STATUS와 재접속 스냅샷으로 제한을 갱신하며 다른 채널·잘못된 메시지는 무시한다', () => {
  let state = model.chatReducer(model.initialChat, { type: 'snapshot', state: snapshot([], true) })
  assert.equal(state.blocked, true)
  state = model.chatReducer(state, action({ type: 'MY_STATUS', chatBlocked: false }, 'me'))
  assert.equal(state.blocked, false)
  assert.equal(model.chatReducer(state, action({ type: 'MY_STATUS', chatBlocked: true }, 'chat')), state)
  assert.equal(model.chatReducer(state, action(message(-1))), state)
  assert.equal(model.chatReducer(state, { type: 'reset' }), model.initialChat)
})

test('서버의 닉네임·교수 배지·부모 ID를 그대로 보존한다', () => {
  const value = message(2, { nickname: '김교수', parentId: 1, parentPreview: '학생 질문' })
  const state = model.chatReducer(model.initialChat, action(value))
  for (const key of ['nickname', 'isOwner', 'parentId', 'parentPreview']) assert.equal(state.messages[0][key], value[key])
})

test('300자는 서버와 같은 유니코드 문자 기준이며 공백·잘못된 서로게이트를 거절한다', () => {
  for (const value of ['가'.repeat(300), '😀'.repeat(300), '질문\n내용']) assert.equal(model.chatContentError(value), '')
  for (const value of ['', '  \n ', '가'.repeat(301), '😀'.repeat(301), '\uD800']) assert.notEqual(model.chatContentError(value), '')
})

function harness() {
  const slots = []
  let index = 0
  let effects = []
  let roomId = 40
  let ready = true
  let statusListener
  const calls = []
  let now = 0
  let nextTimer = 0
  const timers = new Map()
  const react = {
    useCallback(callback) { return callback },
    useState(initial) { const slot = index++; slots[slot] ??= { value: initial }; return [slots[slot].value, (value) => { slots[slot].value = value }] },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial } },
    useReducer(reduce, initial) { const slot = index++; slots[slot] ??= { value: initial }; return [slots[slot].value, (action) => { slots[slot].value = reduce(slots[slot].value, action) }] },
    useEffect(effect, deps) {
      const slot = index++
      if (!slots[slot] || deps.some((value, i) => value !== slots[slot].deps[i])) {
        slots[slot]?.cleanup?.(); slots[slot] = { deps }; effects.push(() => { slots[slot].cleanup = effect() })
      }
    },
  }
  const { useRoomChat } = load('useRoomChat', { react, './chatState': model, '../../shared/stomp': {
    publish: (...args) => { calls.push(plain(args)); return true },
    onStompErrorMessage() { assert.fail('채팅 훅에서 오류를 따로 구독하지 않는다') },
    onStompStatus: (listener) => { statusListener = listener; return () => {} },
  } }, 'ts', {
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id },
    clearTimeout(id) { timers.delete(id) },
  })
  const render = () => { index = 0; effects = []; const result = useRoomChat(roomId, ready); effects.forEach((effect) => effect()); return result }
  render().restore(snapshot())
  return { render, calls, error: (value) => render().handleError(value), status: (value) => statusListener(value),
    switchRoom() { roomId++; render(); return render() }, disconnect() { ready = false; return render() },
    timers, advance(ms) { now += ms; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback() } },
    unmount() { slots.forEach((slot) => slot.cleanup?.()) } }
}

test('한 번만 전송하고 자기 MESSAGE 확인 전까지 성공 처리하거나 로컬 메시지를 만들지 않는다', async () => {
  const hook = harness()
  const pending = hook.render().send('실제 질문', 1)
  assert.equal(await hook.render().send('중복 전송'), false)
  assert.equal(hook.render().sending, true)
  assert.equal(hook.render().messages.length, 0)
  assert.deepEqual(hook.calls, [['/app/rooms/40/chat', { content: '실제 질문', parentId: 1 }]])
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(2, { content: '실제 질문', parentId: 1 }) })
  assert.equal(await pending, true)
  assert.equal(hook.render().sending, false)
  assert.equal(hook.render().messages.length, 1)
  hook.unmount()
})

test('도배 제한·연결 종료 시 실패를 돌려 입력을 보존하고 답 마감 오류는 채팅과 섞지 않는다', async () => {
  const hook = harness()
  const request = hook.render().send('남길 내용')
  hook.error({ code: 'QUESTION_CLOSED', sentAt: '', message: '마감' })
  assert.equal(hook.render().sending, true)
  const failure = { code: 'RATE_LIMITED', sentAt: '', message: '제한' }
  assert.equal(hook.error(failure), true)
  assert.equal(hook.render().sending, true)
  hook.advance(10000)
  assert.equal(hook.error({ ...failure }), false)
  assert.equal(await request, false)
  assert.match(hook.render().error, /너무 자주/)
  const next = hook.render().send('다음 내용')
  hook.status('reconnecting')
  assert.equal(await next, false)
  assert.match(hook.render().error, /다시 보내/)
  hook.unmount()
})

test('다른 작성자나 다른 답글 대상의 MESSAGE로는 성공 처리하지 않는다', async () => {
  const hook = harness()
  const pending = hook.render().send('동일한 내용', 1)
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(2, { content: '동일한 내용', parentId: 2 }) })
  assert.equal(hook.render().sending, true)
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(3, { content: '동일한 내용', parentId: 1, senderParticipantId: 99, isOwner: false }) })
  assert.equal(hook.render().sending, true)
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(4, { content: '동일한 내용', parentId: 1 }) })
  assert.equal(await pending, true)
  assert.equal(hook.timers.size, 0)
  hook.unmount()
})

test('반응의 RATE_LIMITED가 먼저 와도 뒤의 내 MESSAGE로 성공하고 오류를 지운다', async () => {
  const hook = harness()
  const pending = hook.render().send('서버에 전달된 질문')
  hook.error({ code: 'RATE_LIMITED', sentAt: '', message: '반응 제한' })
  assert.equal(hook.render().sending, true)
  assert.match(hook.render().error, /너무 자주/)
  assert.equal(await hook.render().send('조기 재전송'), false)
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(2, { content: '서버에 전달된 질문' }) })
  assert.equal(await pending, true)
  assert.equal(hook.render().error, '')
  assert.equal(hook.calls.length, 1)
  const next = hook.render().send('새로 작성한 질문')
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(2, { content: '서버에 전달된 질문' }) })
  assert.equal(hook.render().sending, true)
  hook.render().receive('chat', { type: 'MESSAGE', sentAt: '', ...message(3, { content: '새로 작성한 질문' }) })
  assert.equal(await next, true)
  hook.unmount()
})

test('MESSAGE가 없으면 10초에 실패하고 MY_STATUS 차단은 대기를 즉시 종료한다', async () => {
  const hook = harness()
  const pending = hook.render().send('확인되지 않은 질문')
  hook.advance(9999)
  assert.equal(hook.render().sending, true)
  hook.advance(1)
  assert.equal(await pending, false)
  assert.match(hook.render().error, /전송 결과를 확인하지 못했습니다/)
  const blocked = hook.render().send('차단 직전 질문')
  hook.render().receive('chat', { type: 'MY_STATUS', sentAt: '', chatBlocked: true })
  assert.equal(hook.render().sending, true)
  hook.render().receive('me', { type: 'MY_STATUS', sentAt: '', chatBlocked: true })
  assert.equal(await blocked, false)
  assert.equal(hook.render().blocked, true)
  assert.equal(hook.timers.size, 0)
  hook.unmount()
})

test('차단·미연결·잘못된 입력은 전송하지 않고 방 이동 시 이전 요청과 메시지를 정리한다', async () => {
  const hook = harness()
  hook.render().receive('me', { type: 'MY_STATUS', sentAt: '', chatBlocked: true })
  assert.equal(await hook.render().send('차단된 요청'), false)
  hook.render().restore(snapshot())
  assert.equal(await hook.render().send('😀'.repeat(301)), false)
  assert.equal(hook.calls.length, 0)
  const pending = hook.render().send('이전 방 요청')
  const next = hook.switchRoom()
  assert.equal(await pending, false)
  assert.equal(next.messages.length, 0)
  assert.equal(next.sending, false)
  assert.equal(await hook.disconnect().send('미연결'), false)
  assert.equal(hook.calls.length, 1)
  hook.unmount()
})

test('교수 관리 API는 실제 계약대로 요청하고 오류를 그대로 전달한다', async () => {
  const calls = []
  const api = load('api', { '../../shared/api/client': { apiClient: {
    get: async (url) => { calls.push(['GET', url]); return { data: { email: 'student@local.test' } } },
    patch: async (url, body) => { calls.push(['PATCH', url, plain(body)]); return { data: { chatBlocked: body.chatBlocked } } },
    delete: async (url) => { calls.push(['DELETE', url]); throw new Error('거부됨') },
  } } })
  assert.equal((await api.getChatAuthor(40, 5)).email, 'student@local.test')
  assert.equal((await api.setChatBlocked(40, 10, true)).chatBlocked, true)
  await assert.rejects(api.deleteChatMessage(40, 5), /거부됨/)
  assert.deepEqual(calls, [['GET', '/rooms/40/messages/5/author'], ['PATCH', '/rooms/40/participants/10', { chatBlocked: true }], ['DELETE', '/rooms/40/messages/5']])
})

function component(file, dependencies = {}, globals = {}) {
  const slots = []
  let index = 0
  const { [file]: render } = load(file, { 'react/jsx-runtime': jsxRuntime, './Chat.css': {},
    react: { useId: () => 'moderation-menu', useRef: current => ({ current }), useState(initial) { const slot = index++; slots[slot] ??= { value: initial }; return [slots[slot].value, value => { slots[slot].value = value }] } },
    ...dependencies }, 'tsx', globals)
  return props => { index = 0; return render(props) }
}
function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined
  if (predicate(element)) return element
  for (const child of [element.props?.children].flat()) { const match = find(child, predicate); if (match) return match }
}
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve() }

test('삭제 확인창은 포털로 목록 밖에 렌더링하고 취소 시 보존하며 최종 확인한 메시지만 삭제한다', async () => {
  const calls = []
  const ConfirmDialog = () => null
  const body = {}
  let portal
  const render = component('ChatModeration', {
    'react-dom': { createPortal(dialog, target) { assert.equal(target, body); portal = dialog; return null } },
    '../auth/api': { toApiError: error => error }, '../professor/components/Modal': {},
    '../../shared/components/ConfirmDialog': { ConfirmDialog },
    './api': { deleteChatMessage: async (...args) => { calls.push(args) } },
    '../room/api': {},
  }, { document: { body } })
  const props = { roomId: 40, message: message(8) }
  const view = () => { portal = undefined; return render(props) }
  const request = () => find(view(), element => element.type === 'button' && element.props.children?.at(-1) === '메시지 삭제').props.onClick()
  request()
  assert.equal(calls.length, 0)
  assert.equal(find(view(), element => element.type === ConfirmDialog), undefined)
  portal.props.onCancel()
  view()
  assert.equal(portal, undefined)
  assert.equal(calls.length, 0)
  request()
  view()
  portal.props.onConfirm()
  await flush()
  assert.deepEqual(calls, [[40, 8]])
})

test('작성자 확인은 참가자 메시지에만 표시하고 교수 메시지의 고정·삭제는 유지한다', async () => {
  const calls = []
  const render = component('ChatModeration', {
    'react-dom': {}, '../auth/api': {}, '../professor/components/Modal': {},
    '../../shared/components/ConfirmDialog': {}, '../room/api': {},
    './api': { async getChatAuthor(...args) { calls.push(args); return null } },
  })
  const button = (tree, name) => find(tree, el => el.type === 'button' && el.props.children?.at(-1) === name)
  const teacher = render({ roomId: 40, message: message(8) })
  assert.equal(button(teacher, '작성자 확인'), undefined)
  assert.ok(button(teacher, '공지 고정'))
  assert.ok(button(teacher, '메시지 삭제'))
  const student = render({ roomId: 40, message: message(9, { isOwner: false }) })
  button(student, '작성자 확인').props.onClick()
  await flush()
  assert.deepEqual(calls, [[40, 9]])
})

test('공지 고정은 고른 메시지로 요청하고 삭제·종료 오류를 관리 메뉴에 표시한다', async () => {
  const calls = []
  let code
  const render = component('ChatModeration', {
    'react-dom': {}, '../auth/api': { toApiError: error => error }, '../professor/components/Modal': {},
    '../../shared/components/ConfirmDialog': {}, './api': {},
    '../room/api': { async pinMessage(...args) { calls.push(args); if (code) throw { code, message: code === 'MESSAGE_DELETED' ? '삭제된 메시지입니다' : '종료된 방입니다' } } },
  })
  const props = { roomId: 40, message: message(8) }
  const pin = async () => { find(render(props), element => element.type === 'button' && element.props.children?.at(-1) === '공지 고정').props.onClick(); await flush() }
  await pin()
  assert.deepEqual(calls, [[40, 8]])
  assert.match(find(render(props), element => element.props.role === 'status').props.children, /고정했습니다/)
  for (code of ['MESSAGE_DELETED', 'ROOM_CLOSED']) {
    await pin()
    assert.match(find(render(props), element => element.props.role === 'alert').props.children, /메시지|종료된 방/)
  }
})

test('공지 고정 API는 PUT 경로와 백엔드 메시지 응답을 그대로 사용한다', async () => {
  const calls = []
  const response = message(8)
  const api = load('../room/api', { '../../shared/api/client': { apiClient: {
    async put(...args) { calls.push(args); return { data: response } },
  } } })
  assert.equal(await api.pinMessage(40, 8), response)
  assert.deepEqual(calls, [['/rooms/40/pinned-messages/8']])
})

test('전송 중 입력은 readOnly로 유지하고 실패한 초안은 보존하며 성공한 초안만 비운다', async () => {
  const render = component('ChatComposer')
  let resolve
  let sent = 0
  const chat = { ready: true, blocked: false, sending: false, send: () => new Promise(done => { resolve = done }) }
  const props = { chat, onSent: () => { sent++ }, placeholder: '수업 안내나 답글을 입력하세요' }
  const textarea = () => find(render(props), element => element.type === 'textarea').props
  textarea().onChange({ target: { value: '보존할 초안' } })
  render(props).props.onSubmit({ preventDefault() {} })
  chat.sending = true
  assert.equal(textarea().disabled, false)
  assert.equal(textarea().readOnly, true)
  assert.equal(textarea().placeholder, props.placeholder)
  assert.equal(find(render(props), element => element.type === 'button').props.disabled, true)
  resolve(false)
  await flush()
  assert.equal(textarea().value, '보존할 초안')
  chat.sending = false
  render(props).props.onSubmit({ preventDefault() {} })
  resolve(true)
  await flush()
  assert.equal(textarea().value, '')
  assert.equal(sent, 1)
})

test('교수 퀴즈는 채팅 STOMP 오류를 중복 구독하지 않고 REST 실패 안내는 유지한다', async () => {
  const errors = []
  const { useProfessorQuiz } = load('../quiz/hooks/useProfessorQuiz', {
    react: { useCallback: callback => callback, useRef: value => ({ current: value }) },
    '../../auth/api': { toApiError: error => error },
    '../../../shared/stomp': { getStompStatus: () => 'connected', onStompErrorMessage() { assert.fail('채팅 오류 중복 구독') } },
    '../../room/useClassroom': { useClassroom: () => ({ quiz: { phase: 'waiting' }, ready: true }) },
    '../api': { startQuiz: async () => { throw new Error('시작 실패') }, closeQuizResults: async () => {} },
  })
  const quiz = useProfessorQuiz(40, error => errors.push(error))
  await quiz.start(2)
  await quiz.closeResults()
  assert.deepEqual(errors, ['시작 실패'])
})
