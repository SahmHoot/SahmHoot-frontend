import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

const noRoom = { id: null, name: '', code: '', joinUrl: null, participants: 0, active: false }
const created = { id: 38, title: '실제 수업', joinCode: '123456', joinUrl: 'https://class.example/join/123456' }
const summary = { id: 52, title: '진행 중 수업', joinCode: '654321', onlineCount: 7, status: 'PLAYING' }
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(setImmediate) }

function harness(file, name, dependencies, extension = 'ts') {
  const slots = []
  let index = 0
  let effects = []
  const react = {
    useState(initial) {
      const slot = index++
      if (!slots[slot]) {
        const cell = { value: typeof initial === 'function' ? initial() : initial }
        cell.set = (next) => { cell.value = typeof next === 'function' ? next(cell.value) : next }
        slots[slot] = cell
      }
      return [slots[slot].value, slots[slot].set]
    },
    useRef(initial) {
      const slot = index++
      return slots[slot] ??= { current: initial }
    },
    useEffect(effect, deps) {
      const slot = index++
      if (!slots[slot] || deps.some((value, i) => value !== slots[slot].deps[i])) {
        slots[slot]?.cleanup?.()
        slots[slot] = { deps }
        effects.push(() => { slots[slot].cleanup = effect() })
      }
    },
  }
  const source = readFileSync(new URL(`../src/features/${file}.${extension}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  runInNewContext(outputText, { exports, window: { setTimeout: () => 1, clearTimeout() {} },
    require: (id) => id === 'react' ? react : dependencies[id] ?? (() => { throw new Error(`Unexpected import: ${id}`) })() })
  return {
    render(props) { index = 0; effects = []; const result = exports[name](props); effects.forEach((effect) => effect()); return result },
    unmount() { slots.forEach((slot) => slot.cleanup?.()) },
  }
}

function dashboard(api = {}) {
  const navigation = []
  const bindings = []
  const requests = []
  let routeKey = 0
  let location = { pathname: '/professor/create', key: String(routeKey) }
  const hook = harness('professor/hooks/useProfessorDashboard', 'useProfessorDashboard', {
    'react-router-dom': { useNavigate: () => (path) => {
      navigation.push(path)
      location = { pathname: path, key: String(++routeKey) }
    }, useLocation: () => location },
    '../../auth/api': { toApiError: (error) => ({ message: error.message }) },
    '../../room/api': { createRoom: async () => created, closeRoom: async () => {}, ...api },
    '../dashboard-data': { noRoom, demoMessages: [], demoNotice: '' },
    '../../quiz/hooks/useProfessorQuiz': { useProfessorQuiz: (roomId) => {
      bindings.push(roomId)
      return { quiz: { phase: 'waiting' }, ready: roomId !== null,
        start: (setId) => requests.push(['start', roomId, setId]),
        stop: () => requests.push(['stop', roomId]),
        closeResults: () => requests.push(['wait', roomId]) }
    } },
  })
  return { ...hook, navigation, bindings, requests,
    visit(pathname) { location = { pathname, key: String(++routeKey) }; return hook.render() } }
}

test('개설 응답의 실제 방 ID·코드·URL을 보존하고 퀴즈 요청을 같은 방에 연결한다', async () => {
  let title
  const hook = dashboard({ createRoom: async (value) => { title = value; return created } })
  assert.equal(hook.render().quizReady, false)
  await hook.render().createRoom('실제 수업')
  const state = hook.render()
  assert.equal(title, '실제 수업')
  assert.equal(state.room.id, 38)
  assert.equal(state.room.code, created.joinCode)
  assert.equal(state.room.joinUrl, created.joinUrl)
  assert.equal(state.quizReady, true)
  state.startQuiz(63); state.stopQuiz(); state.closeResults()
  assert.deepEqual(hook.requests, [['start', 38, 63], ['stop', 38], ['wait', 38]])
})

test('목록에서 다른 방을 열면 방 ID·인원과 퀴즈 연결 대상을 함께 바꾼다', async () => {
  const hook = dashboard()
  await hook.render().createRoom('실제 수업')
  hook.render().openRoom(summary)
  const state = hook.render()
  assert.equal(state.room.id, 52)
  assert.equal(state.room.participants, 7)
  assert.equal(state.room.joinUrl, null)
  state.startQuiz(63)
  assert.deepEqual(hook.requests, [['start', 52, 63]])
  assert.deepEqual(hook.navigation, ['/professor/room'])
})

test('개설 실패를 화면에 전달하고 성공한 방처럼 표시하지 않는다', async () => {
  const hook = dashboard({ createRoom: async () => { throw new Error('개설 실패') } })
  await assert.rejects(hook.render().createRoom('실제 수업'), /개설 실패/)
  assert.equal(hook.render().room.id, null)
  assert.equal(hook.render().quizReady, false)
})

test('늦은 개설 응답이 이후 선택한 수업·퀴즈·종료 대상을 덮어쓰지 않는다', async () => {
  let resolve
  const closed = []
  const hook = dashboard({ createRoom: () => new Promise((done) => { resolve = done }),
    closeRoom: async (id) => { closed.push(id) } })
  const pending = hook.render().createRoom('늦게 개설되는 수업')
  hook.render().openRoom(summary)
  resolve(created)
  await pending
  const state = hook.render()
  assert.equal(state.room.id, summary.id)
  assert.equal(state.room.name, summary.title)
  assert.equal(state.room.code, summary.joinCode)
  state.startQuiz(63)
  assert.deepEqual(hook.requests, [['start', summary.id, 63]])
  await state.endRoom()
  assert.deepEqual(closed, [summary.id])
})

test('개설 화면 이탈·재진입 후에는 이전 응답을 무시하고 새 개설만 반영한다', async () => {
  for (const destination of ['/professor', '/professor/sets']) {
    const responses = []
    const hook = dashboard({ createRoom: () => new Promise((resolve) => { responses.push(resolve) }) })
    const previous = hook.render().createRoom('이전 수업')
    hook.visit(destination)
    hook.visit('/professor/create')
    responses[0](created)
    await previous
    assert.equal(hook.render().room.id, null)
    const current = hook.render().createRoom('새 수업')
    responses[1]({ ...created, id: 99, title: '새 수업' })
    await current
    assert.equal(hook.render().room.id, 99)
  }
})

test('종료 요청 중 cancel 이벤트의 기본 닫기와 닫기 버튼을 막고 실패 후 다시 허용한다', () => {
  let closed = 0
  const onCancel = () => { closed++ }
  const modal = harness('professor/components/Modal', 'Modal', {
    'react/jsx-runtime': jsxRuntime, './Modal.css': {},
  }, 'tsx')
  const endDialog = harness('professor/components/EndClassDialog', 'EndClassDialog', {
    'react/jsx-runtime': jsxRuntime, './EndClassDialog.css': {}, './Modal': { Modal: () => null },
  }, 'tsx')
  for (const pending of [true, false]) {
    const dialog = endDialog.render({ roomName: summary.title, pending, onCancel, onConfirm() {} })
    const element = modal.render(dialog.props)
    const cancel = new Event('cancel', { cancelable: true })
    element.props.onCancel(cancel)
    assert.equal(cancel.defaultPrevented, pending)
    assert.equal(closed, pending ? 0 : 1)
    assert.equal(Boolean(element.props.children[0].props.children[1].props.disabled), pending)
    for (const button of dialog.props.children[2].props.children) assert.equal(button.props.disabled, pending)
  }
  const ordinary = modal.render({ title: '다른 대화상자', onClose: onCancel })
  const cancel = new Event('cancel', { cancelable: true })
  ordinary.props.onCancel(cancel)
  assert.equal(cancel.defaultPrevented, false)
  assert.equal(closed, 2)
  assert.equal(Boolean(ordinary.props.children[0].props.children[1].props.disabled), false)
})

test('종료 중 중복 요청·닫기를 막고 실패 시 방을 유지한 뒤 재시도로 종료한다', async () => {
  let reject
  let fail = true
  const closed = []
  const hook = dashboard({ closeRoom: (id) => {
    closed.push(id)
    return fail ? new Promise((_, rejectRequest) => { reject = rejectRequest }) : Promise.resolve()
  } })
  hook.render().openRoom(summary)
  hook.render().setEnding(true)
  const state = hook.render()
  const first = state.endRoom()
  await state.endRoom()
  state.cancelEnding()
  assert.equal(hook.render().endPending, true)
  assert.equal(hook.render().ending, true)
  assert.deepEqual(closed, [52])
  reject(new Error('종료 실패'))
  await first
  assert.equal(hook.render().room.id, 52)
  assert.equal(hook.render().room.active, true)
  assert.equal(hook.render().endError, '종료 실패')
  assert.equal(hook.render().endPending, false)
  hook.render().cancelEnding()
  assert.equal(hook.render().endError, '')
  fail = false
  await hook.render().endRoom()
  assert.equal(hook.render().room.id, null)
  assert.equal(hook.render().quizReady, false)
  assert.equal(hook.navigation.at(-1), '/professor')
})

test('목록 조회 실패를 안내하고 재시도·재진입마다 서버 목록을 다시 읽는다', async () => {
  let reads = 0
  const deps = { '../auth/api': { toApiError: (error) => ({ message: error.message }) },
    './api': { fetchMyRooms: async () => { reads++; if (reads === 1) throw new Error('연결 실패'); return [summary] } } }
  const hook = harness('room/useMyRooms', 'useMyRooms', deps)
  assert.equal(hook.render().state.status, 'loading')
  await flush()
  assert.equal(hook.render().state.message, '연결 실패')
  hook.render().reload()
  hook.render()
  await flush()
  assert.equal(hook.render().state.rooms[0].id, 52)
  hook.unmount()
  const reopened = harness('room/useMyRooms', 'useMyRooms', deps)
  reopened.render()
  await flush()
  assert.equal(reads, 3)
  assert.equal(reopened.render().state.rooms[0].id, 52)
})
