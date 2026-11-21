import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const noRoom = { id: null, name: '', code: '', joinUrl: null, participants: 0, active: false }
const created = { id: 38, title: '실제 수업', joinCode: '123456', joinUrl: 'https://class.example/join/123456' }
const summary = { id: 52, title: '진행 중 수업', joinCode: '654321', onlineCount: 7, status: 'PLAYING' }
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(setImmediate) }
const roomChat = { messages: [], received: 0, roomId: 52, ready: true }

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
  runInNewContext(outputText, { exports, crypto, window: { setTimeout: () => 1, clearTimeout() {} },
    require: (id) => id === 'react' ? react : dependencies[id] ?? (() => { throw new Error(`Unexpected import: ${id}`) })() })
  return {
    render(props) { index = 0; effects = []; const result = exports[name](props); effects.forEach((effect) => effect()); return result },
    unmount() { slots.forEach((slot) => slot.cleanup?.()) },
  }
}

function dashboard(api = {}, { restoredRoomId = null, initialPath = '/professor/create', user = { id: 1, name: '검증 교수' },
  classroom = () => ({}) } = {}) {
  const navigation = []
  const bindings = []
  const requests = []
  let routeKey = 0
  let location = { pathname: initialPath, key: String(routeKey) }
  const hook = harness('professor/hooks/useProfessorDashboard', 'useProfessorDashboard', {
    'react-router-dom': { useNavigate: () => (path) => {
      navigation.push(path)
      location = { pathname: path, key: String(++routeKey) }
    }, useLocation: () => location },
    '../../auth/api': { toApiError: (error) => ({ message: error.message }) },
    '../../auth/AuthProvider': { useAuth: () => ({ user }) },
    '../roomStorage': { readRoomId: () => restoredRoomId, writeRoomId() {} },
    '../../room/api': { createRoom: async () => created, closeRoom: async () => {}, ...api },
    '../dashboard-data': { noRoom },
    '../../quiz/hooks/useProfessorQuiz': { useProfessorQuiz: (roomId) => {
      bindings.push(roomId)
      return { chat: roomChat, ...classroom(roomId), quiz: { phase: 'waiting' }, ready: roomId !== null,
        start: (setId) => requests.push(['start', roomId, setId]),
        stop: () => requests.push(['stop', roomId]),
        closeResults: () => requests.push(['wait', roomId]) }
    } },
  })
  return { ...hook, navigation, bindings, requests,
    visit(pathname) { location = { pathname, key: String(++routeKey) }; return hook.render() } }
}

test('교수 화면은 공통 실시간 채팅 상태를 전달한다', () => {
  const hook = dashboard()
  hook.render().openRoom(summary)
  assert.equal(hook.render().chat, roomChat)
})

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

test('종료창은 닫기 버튼 없이 취소·확정만 표시하고 종료 중 취소·ESC를 막는다', () => {
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
    const markup = renderToStaticMarkup(element)
    assert.doesNotMatch(markup, /professor-modal__close-button/)
    assert.equal((markup.match(/<button\b/g) ?? []).length, 2)
    assert.match(markup, />취소<\/button>/)
    assert.match(markup, pending ? />종료하는 중…<\/button>/ : />수업 종료<\/button>/)
    for (const button of dialog.props.children[2].props.children) assert.equal(button.props.disabled, pending)
  }
  const ordinary = modal.render({ title: '다른 대화상자', onClose: onCancel })
  const cancel = new Event('cancel', { cancelable: true })
  ordinary.props.onCancel(cancel)
  assert.equal(cancel.defaultPrevented, false)
  assert.equal(closed, 2)
  assert.equal(Boolean(ordinary.props.children[0].props.children[1].props.disabled), false)
  assert.match(renderToStaticMarkup(ordinary), /professor-modal__close-button[^>]*>닫기<\/button>/)
  ordinary.props.children[0].props.children[1].props.onClick()
  assert.equal(closed, 3)
  const locked = modal.render({ title: '처리 중인 대화상자', onClose: onCancel, closable: false })
  assert.equal(locked.props.children[0].props.children[1].props.disabled, true)
  const lockedCancel = new Event('cancel', { cancelable: true })
  locked.props.onCancel(lockedCancel)
  assert.equal(lockedCancel.defaultPrevented, true)
  assert.equal(closed, 3)
})

test('퀴즈 중단·세트 삭제 확인창은 닫기 버튼 없이 취소와 확정 동작을 유지한다', () => {
  function find(element, predicate) {
    if (!element || typeof element !== 'object') return undefined
    if (predicate(element)) return element
    for (const child of [element.props?.children].flat()) { const found = find(child, predicate); if (found) return found }
  }
  const modal = harness('professor/components/Modal', 'Modal', {
    'react/jsx-runtime': jsxRuntime, './Modal.css': {},
  }, 'tsx')
  const Modal = () => null
  const QuizQuestion = () => null
  const screen = harness('professor/screens/ProfessorRoom', 'ProfessorRoom', {
    'react/jsx-runtime': jsxRuntime, './ProfessorRoom.css': {}, 'react-router-dom': {},
    '../components/Icon': {}, '../components/RoomSetPicker': {}, '../components/Reactions': {},
    '../components/JoinCode': { JoinCode: () => null }, '../components/Chat': { Chat: () => null },
    '../components/QuizQuestion': { QuizQuestion }, '../components/Modal': { Modal },
  }, 'tsx')
  let stops = 0
  const props = { room: { ...noRoom, active: true }, quiz: { phase: 'question' }, onStopQuiz() { stops++ } }
  const stopDialog = () => find(screen.render(props), el => el.type === Modal)
  const openStop = () => find(screen.render(props), el => el.type === QuizQuestion).props.onStop()
  openStop()
  const stop = stopDialog()
  let deleting = { id: 8, title: '삭제할 세트' }
  let deletes = 0
  const list = harness('professor/screens/QuizSetList', 'QuizSetList', {
    'react/jsx-runtime': jsxRuntime, './QuizSetList.css': {},
    'react-router-dom': { useNavigate: () => () => {} }, '../components/Icon': {}, '../components/Modal': { Modal },
    '../../questionset/useQuestionSetList': { useQuestionSetList: () => ({ sets: [], deleting,
      setDeleting(value) { deleting = value }, confirmDelete() { deletes++ } }) },
  }, 'tsx')
  const deleteDialog = () => find(list.render(), el => el.type === Modal)
  for (const [dialog, cancelLabel, confirmLabel] of [[stop, '계속 진행', '퀴즈 중단'], [deleteDialog(), '취소', '삭제']]) {
    const markup = renderToStaticMarkup(modal.render(dialog.props))
    assert.doesNotMatch(markup, /professor-modal__close-button/)
    assert.equal((markup.match(/<button\b/g) ?? []).length, 2)
    const cancel = find(dialog, el => el.type === 'button' && el.props.children === cancelLabel)
    const confirm = find(dialog, el => el.type === 'button' && el.props.children === confirmLabel)
    assert.ok(cancel)
    assert.ok(confirm)
    cancel.props.onClick()
    assert.equal(dialog === stop ? stopDialog() : deleteDialog(), undefined)
    confirm.props.onClick()
  }
  assert.equal(stops, 1)
  assert.equal(deletes, 1)
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

test('저장된 실제 방을 새로고침 복원하면 예제 채팅·공지를 표시하지 않는다', () => {
  const hook = dashboard({}, { restoredRoomId: summary.id, initialPath: '/professor/room' })
  const state = hook.render()
  assert.equal(state.room.id, summary.id)
  assert.equal(state.room.active, true)
  assert.equal(state.chat.messages.length, 0)
  assert.equal(state.notices.length, 0)
  assert.equal(hook.bindings.at(-1), summary.id)
})

test('다른 수업으로 이동하면 이전 수업의 고정 공지를 표시하지 않는다', async () => {
  const pinned = [{ id: 5, content: '이전 수업 공지' }]
  // 고정 공지는 수업 동기화가 방마다 새로 받으므로, 지금 방의 스냅샷이 아니면 보여 주지 않는다.
  const hook = dashboard({}, { classroom: (roomId) => roomId === summary.id
    ? { snapshot: { room: { id: summary.id } }, pinned } : {} })
  hook.render().openRoom(summary)
  assert.deepEqual(Array.from(hook.render().notices, ({ id }) => id), [5])
  await hook.render().createRoom('실제 수업')
  assert.equal(hook.render().notices.length, 0)
  hook.render().openRoom(summary)
  assert.equal(hook.render().chat, roomChat)
})

test('고정 해제는 지금 방으로 요청하고 실패하면 안내한다', async () => {
  const calls = []
  let fail = false
  const hook = dashboard({ unpinMessage: async (roomId, messageId) => {
    calls.push([roomId, messageId])
    if (fail) throw new Error('고정 해제 실패')
  } })
  hook.render().unpin(5)
  assert.deepEqual(calls, [])
  hook.render().openRoom(summary)
  hook.render().unpin(5)
  await flush()
  assert.deepEqual(calls, [[summary.id, 5]])
  assert.equal(hook.render().feedback, '')
  fail = true
  hook.render().unpin(6)
  await flush()
  assert.equal(hook.render().feedback, '고정 해제 실패')
})

test('교수 대기 화면만 집계를 표시하고 세 화면 모두 반응과 기존 채팅을 렌더링한다', () => {
  const emojis = ['👍', '❓', '😀', '👏']
  const stats = { '👍': 2, '❓': 0, '😀': 1, '👏': 3 }
  const overlay = harness('room/ChatReactions', 'ChatReactions', {
    'react/jsx-runtime': jsxRuntime, './ChatReactions.css': {},
  }, 'tsx')
  const dependencies = {
    'react/jsx-runtime': jsxRuntime,
    './Reactions.css': {}, './Chat.css': {},
    './Icon': { Icon: () => null }, './Modal': { Modal: () => null },
    '../../room/reactions': { REACTION_EMOJIS: emojis },
    '../../room/ChatReactions': { ChatReactions: (props) => overlay.render(props) },
    '../../chat/ChatComposer': { ChatComposer: () => null }, '../../chat/ChatModeration': { ChatModeration: () => null },
  }
  const reactions = harness('professor/components/Reactions', 'Reactions', dependencies, 'tsx')
  const waiting = renderToStaticMarkup(reactions.render({ participants: 7, stats }))
  assert.match(waiting.replace(/<[^>]*>/g, ''), /접속\s*7명/)
  assert.deepEqual(Array.from(waiting.matchAll(/class="professor-reactions__count">(\d+)</g), ([, count]) => Number(count)), [2, 0, 1, 3])
  assert.match(renderToStaticMarkup(reactions.render({ participants: 7, stats: null })), /반응 집계를 확인할 수 없습니다/)
  const chat = harness('professor/components/Chat', 'Chat', dependencies, 'tsx')
  for (const screen of ['waiting', 'quiz', 'results']) {
    const markup = renderToStaticMarkup(chat.render({
      compact: screen !== 'waiting', screen, notices: [{ id: 5, content: '수업 공지' }],
      chat: { ...roomChat, messages: [{ id: 2, nickname: '학생', content: '기존 채팅', parentId: 1, parentPreview: '답글 원문' }] },
      reactions: [{ id: 'server-event', emoji: '😀', expiresAt: 100, lane: 0 }],
      onSend() {}, onUnpin() {},
    }))
    assert.match(markup, /class="chat-reactions__emoji"[^>]*>😀<\/span>/)
    assert.doesNotMatch(markup, /최근 1분|professor-chat__reactions/)
    for (const text of ['수업 공지', '고정 해제: 수업 공지', '기존 채팅', '답글 원문']) assert.ok(markup.includes(text))
  }
})
