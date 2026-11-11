import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(file, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(outputText, { exports, ...globals, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`)
    return dependencies[id]
  } })
  return exports
}
const clock = load('features/quiz/serverClock')
const reducer = load('features/quiz/professorQuizReducer', { './serverClock': clock })
const time = '2026-11-10T00:00:00Z'
const question = { runQuestionId: 71, questionNo: 1, questionType: 'TRUE_FALSE', timeLimitSeconds: 15,
  content: '서버 문항', choices: [{ id: 1, orderNo: 1, content: 'O' }, { id: 2, orderNo: 2, content: 'X' }],
  openedAt: time, closesAt: '2026-11-10T00:00:15Z', closedAt: null, correctChoiceId: null }
const state = (owner = false, quiz = null) => ({ serverTime: time,
  room: { id: 40, title: '실제 수업', joinCode: '123456', joinUrl: '/join/123456', status: quiz ? 'PLAYING' : 'OPEN', ownerName: '교수' },
  me: { participantId: 9, nickname: '학생이름', isOwner: owner, chatBlocked: false }, onlineCount: 2,
  quizRun: null, quiz, pinnedMessage: null, recentMessages: [] })
const quiz = (phase) => ({ runId: 7, questionSetTitle: '서버 문제집', totalQuestions: 1, phase,
  currentQuestion: phase === 'RESULT' ? null : { ...question, closedAt: phase === 'FEEDBACK' ? time : null },
  nextOpensAt: phase === 'FEEDBACK' ? '2026-11-10T00:00:18Z' : null,
  result: phase === 'RESULT' ? { questions: [] } : null })

function setup(owner = false) {
  const slots = []
  let index = 0
  let effects = []
  let handlers
  let id = 40
  let status = 'connected'
  const react = {
    useState(initial) {
      const slot = index++
      slots[slot] ??= { value: initial }
      return [slots[slot].value, (value) => { slots[slot].value = typeof value === 'function' ? value(slots[slot].value) : value }]
    },
    useReducer(reduce, initial) {
      const slot = index++
      slots[slot] ??= { value: initial }
      return [slots[slot].value, (action) => { slots[slot].value = reduce(slots[slot].value, action) }]
    },
    useEffect(effect, deps) {
      const slot = index++
      if (!slots[slot] || deps.some((value, i) => value !== slots[slot].deps[i])) {
        slots[slot] = { deps }
        effects.push(effect)
      }
    },
  }
  const { useClassroom } = load('features/room/useClassroom', {
    react, '../auth/api': { toApiError: (error) => error }, '../quiz/professorQuizReducer': reducer,
    '../../shared/stomp': { useStompStatus: () => status, useRoomSync(roomId, isOwner, callbacks) {
      assert.equal(roomId, id); assert.equal(isOwner, owner); handlers = callbacks
    } },
  })
  const render = () => { index = 0; effects = []; const value = useClassroom(id, owner); effects.forEach((effect) => effect()); return value }
  render()
  return { render, snapshot: (value) => handlers.onSnapshot(value), message: (channel, value) => handlers.onMessage(channel, value),
    error: (value) => handlers.onSyncError(value), setRoom(value) { id = value; render(); return render() },
    disconnect() { status = 'reconnecting'; return render() } }
}

test('교수·학생이 같은 state로 대기·문항·피드백·결과를 복원한다', () => {
  for (const owner of [false, true]) {
    const room = setup(owner)
    room.snapshot(state(owner))
    assert.equal(room.render().quiz.phase, 'waiting')
    assert.equal(room.render().onlineCount, 2)
    assert.equal(room.render().ready, true)
    for (const [phase, expected] of [['QUESTION', 'question'], ['FEEDBACK', 'between'], ['RESULT', 'results']]) {
      room.snapshot(state(owner, quiz(phase)))
      assert.equal(room.render().quiz.phase, expected)
    }
    assert.equal(room.disconnect().ready, false)
  }
})

test('시작·중단·결과 닫기는 서버 메시지로만 화면 배치를 바꾼다', () => {
  const room = setup()
  room.snapshot(state())
  room.message('quiz', { type: 'QUESTION_OPENED', sentAt: time, runId: 7, runQuestionId: 71, questionNo: 1,
    totalQuestions: 1, content: question.content, choices: question.choices, closesAt: question.closesAt })
  assert.equal(room.render().quiz.phase, 'question')
  room.message('quiz', { type: 'QUIZ_CANCELED', sentAt: time, runId: 7 })
  assert.equal(room.render().quiz.phase, 'waiting')
  room.message('quiz', { type: 'QUIZ_FINISHED', sentAt: time, runId: 8, result: { questions: [] } })
  assert.equal(room.render().quiz.phase, 'results')
  room.message('quiz', { type: 'ROOM_WAITING', sentAt: time })
  assert.equal(room.render().quiz.phase, 'waiting')
})

test('인원은 서버의 전체 값으로 대체하고 음수·소수·잘못된 채널은 무시한다', () => {
  const room = setup()
  room.snapshot(state())
  for (const onlineCount of [1, 1, 3, 0]) {
    room.message('presence', { type: 'ONLINE_COUNT', onlineCount })
    assert.equal(room.render().onlineCount, onlineCount)
  }
  for (const onlineCount of [-1, 1.5, '9', NaN]) room.message('presence', { type: 'ONLINE_COUNT', onlineCount })
  room.message('chat', { type: 'ONLINE_COUNT', onlineCount: 99 })
  assert.equal(room.render().onlineCount, 0)
})

test('ROOM_ENDED와 종료·없는 방 오류를 종료 안내로 처리한다', () => {
  for (const code of ['ROOM_CLOSED', 'ROOM_NOT_FOUND']) {
    const room = setup()
    room.error({ code, message: '서버 오류' })
    assert.equal(room.render().ended, true)
    assert.equal(room.render().ready, false)
  }
  const room = setup()
  room.snapshot(state())
  room.message('quiz', { type: 'ROOM_ENDED', sentAt: time })
  assert.equal(room.render().ended, true)
  assert.equal(room.render().ready, false)
})

test('방 전환 때 이전 퀴즈·인원·종료 상태를 초기화하고 역할 불일치를 막는다', () => {
  const room = setup(true)
  room.snapshot(state(true, quiz('QUESTION')))
  room.message('quiz', { type: 'ROOM_ENDED', sentAt: time })
  const next = room.setRoom(41)
  assert.equal(next.snapshot, null)
  assert.equal(next.quiz.phase, 'waiting')
  assert.equal(next.onlineCount, 0)
  assert.equal(next.ended, false)
  room.snapshot(state(false))
  assert.match(room.render().error, /홈에서 다시 입장/)
  assert.equal(room.render().snapshot, null)
})

test('교수의 복원용 방 ID는 계정별로 저장하고 종료 시 제거하며 잘못된 값은 거절한다', () => {
  const values = new Map()
  const storage = load('features/professor/roomStorage', {}, { sessionStorage: {
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key),
  } })
  storage.writeRoomId(1, 40)
  assert.equal(storage.readRoomId(1), 40)
  assert.equal(storage.readRoomId(2), null)
  assert.equal(storage.readRoomId(undefined), null)
  storage.writeRoomId(1, null)
  assert.equal(storage.readRoomId(1), null)
  for (const value of ['0', '-1', '1.5', 'NaN', '9007199254740992']) {
    values.set('sahmhoot.professor.room.1', value)
    assert.equal(storage.readRoomId(1), null)
  }
})
