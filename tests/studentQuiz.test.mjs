// #30 학생 퀴즈 화면: 답 즉시 제출·같은 답 중복 방지·연결 끊김 안내·마감 뒤 거부 시 되돌리기
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/${path}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const exports = {}
  runInNewContext(outputText, { exports, AbortController, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return exports
}

function setup() {
  const slots = []
  const effects = []
  let index = 0
  const react = {
    useState(initial) {
      const i = index++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
    },
    useReducer(reducer, initial) {
      const i = index++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], (action) => { slots[i] = reducer(slots[i], action) }]
    },
    useEffect(effect, deps) {
      const i = index++
      const previous = effects[i]
      if (previous && deps.every((dep, n) => Object.is(dep, previous.deps[n]))) return
      previous?.cleanup?.()
      effects[i] = { deps, cleanup: effect() }
    },
  }
  const sent = []
  const errorListeners = new Set()
  const stomp = {
    connected: true,
    publish: (destination, body) => { if (!stomp.connected) return false; sent.push({ destination, body }); return true },
    onStompErrorMessage: (listener) => { errorListeners.add(listener); return () => errorListeners.delete(listener) },
  }
  let quiz = { phase: 'waiting' }
  let forward
  /** 서버에 저장된 내 답. 마감된 문항을 서버 답으로 맞출 때 조회한다. */
  const server = { myAnswers: [], fetches: 0 }
  const roomState = { fetchRoomState: async () => { server.fetches += 1; return { quiz: { myAnswers: server.myAnswers } } } }
  const classroom = { useClassroom: (_roomId, _owner, onQuizAction) => { forward = onQuizAction; return { quiz } } }
  const answers = load('student/studentAnswers')
  const { useStudentQuiz } = load('student/hooks/useStudentQuiz', {
    react, '../../../shared/stomp': stomp, '../../room/useClassroom': classroom, '../studentAnswers': answers,
    '../../../shared/api/roomState': roomState,
  })
  const render = () => { index = 0; return useStudentQuiz(40) }
  return {
    sent, stomp, render, server,
    open(runQuestionId, closesAt) {
      quiz = { phase: 'question', runId: 7, runQuestionId }
      forward({ kind: 'message', message: { type: 'QUESTION_OPENED', runId: 7, runQuestionId, questionNo: 1, closesAt }, receivedAt: 0 })
    },
    close() {
      quiz = { ...quiz, phase: 'between' }
      forward({ kind: 'message', message: { type: 'QUESTION_CLOSED', runId: 7, runQuestionId: quiz.runQuestionId, correctChoiceId: 1 }, receivedAt: 0 })
    },
    /** 재연결 뒤 받은 state. 진행 중인 문항과 서버에 저장된 내 답을 담는다. */
    state(runQuestionId, choiceId) {
      forward({ kind: 'snapshot', receivedAt: 0, snapshot: { quiz: { runId: 7, phase: 'QUESTION',
        currentQuestion: { runQuestionId, closesAt: '2026-11-10T10:01:00Z', correctChoiceId: null },
        myAnswers: [{ runQuestionId, choiceId }] } } })
    },
    error: (code, sentAt = '') => errorListeners.forEach((listener) => listener({ type: 'ERROR', code, message: '', sentAt })),
  }
}

test('답을 고르면 바로 보내고, 같은 답을 다시 눌러도 다시 보내지 않는다', () => {
  const room = setup()
  room.render()
  room.open(11)
  room.render().select(1)
  room.render().select(1)
  room.render().select(2)
  assert.deepEqual(room.sent.map(({ destination, body }) => [destination, body.runQuestionId, body.choiceId]),
    [['/app/rooms/40/answer', 11, 1], ['/app/rooms/40/answer', 11, 2]])
  assert.equal(room.render().answerOf(11), 2)
})

test('대기·마감 뒤에는 보내지 않는다', () => {
  const room = setup()
  room.render().select(1)
  room.open(11)
  room.close()
  room.render().select(1)
  assert.equal(room.sent.length, 0)
})

test('연결이 끊겨 보내지 못하면 내 답을 바꾸지 않고 안내한다', () => {
  const room = setup()
  room.render()
  room.open(11)
  room.render().select(1)
  room.stomp.connected = false
  room.render().select(2)
  const view = room.render()
  assert.equal(view.answerOf(11), 1)
  assert.match(view.notice, /연결이 끊겨/)
  room.stomp.connected = true
  room.render().select(2)
  assert.equal(room.render().notice, null)
})

test('마감 뒤 도착해 거부된 답은 되돌리고 그 문항에서 안내한다', () => {
  const room = setup()
  room.render()
  room.open(11)
  room.render().select(1)
  room.render().select(3)
  room.error('QUESTION_CLOSED')
  room.close()
  const view = room.render()
  assert.equal(view.answerOf(11), 1)
  assert.match(view.notice, /반영되지 않았습니다/)
  // 다른 거부(채팅 등)는 답과 무관하다.
  room.error('RATE_LIMITED')
  assert.equal(room.render().answerOf(11), 1)
  // 다음 문항에서는 이전 안내를 보이지 않는다.
  room.open(12)
  assert.equal(room.render().notice, null)
})

test('앞 문항의 늦은 거부가 다음 문항에 고른 답과 안내를 바꾸지 않는다', () => {
  const room = setup()
  room.render()
  room.open(11, '2026-11-10T10:01:00Z')
  room.render().select(1)
  room.render().select(3)
  room.close()
  room.open(12, '2026-11-10T10:02:00Z')
  room.render().select(5)
  // 11번의 3이 늦게 도착해 12번이 열려 있는 동안 거부됐다.
  room.error('QUESTION_CLOSED', '2026-11-10T10:01:30.5Z')
  const view = room.render()
  assert.equal(view.answerOf(12), 5)
  assert.equal(view.answerOf(11), 1)
  assert.equal(view.notice, null)
})

test('재연결 뒤 늦게 온 state가 그 사이 고른 답을 덮지 않고, 그 답을 다시 보내 서버와 맞춘다', () => {
  const room = setup()
  room.render()
  room.open(11, '2026-11-10T10:01:00Z')
  room.render().select(2)
  room.state(11, 2)
  room.render().select(1)
  // ①을 고르기 전에 만들어진 state가 늦게 도착했다.
  room.state(11, 2)
  const view = room.render()
  assert.equal(view.answerOf(11), 1)
  assert.deepEqual(room.sent.map(({ body }) => body.choiceId), [2, 1, 1])
  // 다시 그려도 한 번만 보낸다.
  room.render()
  assert.equal(room.sent.length, 3)
})

/** ②로 확인된 뒤 ①로 바꿨는데(서버 ①), 그 전에 만들어진 state(②)가 늦게 도착하고 바로 뒤에 마감이 적용된다. */
function staleStateThenClose() {
  const room = setup()
  room.render()
  room.open(11, '2026-11-10T10:01:00Z')
  room.render().select(2)
  room.state(11, 2)
  room.render().select(1)
  room.state(11, 2)
  room.close()
  return room
}
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('늦은 state와 마감이 겹치면 마감된 문항에 다시 보내지 않고 서버 답으로 맞춘다', async () => {
  const room = staleStateThenClose()
  room.server.myAnswers = [{ runQuestionId: 11, choiceId: 1 }]
  room.render()
  assert.deepEqual(room.sent.map(({ body }) => body.choiceId), [2, 1])
  await settle()
  const view = room.render()
  assert.equal(room.server.fetches, 1)
  assert.equal(view.answerOf(11), 1)
  assert.equal(view.notice, null)
})

test('다시 보낸 답이 마감으로 거부돼도 앞서 저장된 답을 지우지 않고 서버 답으로 맞춘다', async () => {
  const room = setup()
  room.render()
  room.open(11, '2026-11-10T10:01:00Z')
  room.render().select(2)
  room.state(11, 2)
  room.render().select(1)
  room.state(11, 2)
  room.render()
  assert.deepEqual(room.sent.map(({ body }) => body.choiceId), [2, 1, 1])
  // 다시 보낸 ①이 마감 뒤 도착해 거부됐다. 처음 보낸 ①은 서버에 저장돼 있다.
  room.server.myAnswers = [{ runQuestionId: 11, choiceId: 1 }]
  room.close()
  room.error('QUESTION_CLOSED', '2026-11-10T10:01:01.500Z')
  room.render()
  await settle()
  const view = room.render()
  assert.equal(view.answerOf(11), 1)
  assert.equal(view.notice, null)
})

test('끊긴 동안 보낸 답이 사라졌으면 마감 뒤 서버 답으로 되돌리고 안내한다', async () => {
  const room = staleStateThenClose()
  room.server.myAnswers = [{ runQuestionId: 11, choiceId: 2 }]
  room.render()
  await settle()
  const view = room.render()
  assert.equal(view.answerOf(11), 2)
  assert.match(view.notice, /반영되지 않았습니다/)
})
