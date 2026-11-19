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
const reactions = load('features/room/reactions')
const time = '2026-11-10T00:00:00Z'
const question = { runQuestionId: 71, questionNo: 1, questionType: 'TRUE_FALSE', timeLimitSeconds: 15,
  content: '서버 문항', choices: [{ id: 1, orderNo: 1, content: 'O' }, { id: 2, orderNo: 2, content: 'X' }],
  openedAt: time, closesAt: '2026-11-10T00:00:15Z', closedAt: null, correctChoiceId: null }
const state = (owner = false, quiz = null) => ({ serverTime: time,
  room: { id: 40, title: '실제 수업', joinCode: '123456', joinUrl: '/join/123456', status: quiz ? 'PLAYING' : 'OPEN', ownerName: '교수' },
  me: { participantId: 9, nickname: '학생이름', isOwner: owner, chatBlocked: false }, onlineCount: 2,
  quizRun: null, quiz, pinnedMessages: [], recentMessages: [] })
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
  let syncId
  let status = 'connected'
  let now = Date.parse(time)
  let canPublish = true
  const sent = []
  const errors = new Set()
  const timers = new Map()
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
        const previous = slots[slot]
        const current = { deps }
        slots[slot] = current
        effects.push(() => {
          previous?.cleanup?.()
          current.cleanup = effect()
        })
      }
    },
  }
  const { useClassroom } = load('features/room/useClassroom', {
    react, '../auth/api': { toApiError: (error) => error }, '../quiz/professorQuizReducer': reducer, './reactions': reactions,
    '../../shared/stomp': { useStompStatus: () => status, useRoomSync(roomId, isOwner, callbacks) {
      syncId = roomId
      assert.equal(isOwner, owner); handlers = callbacks
    }, publish(destination, body) {
      if (canPublish) sent.push([destination, JSON.stringify(body)])
      return canPublish
    }, onStompErrorMessage(listener) {
      errors.add(listener)
      return () => errors.delete(listener)
    } },
  }, {
    Date: { now: () => now },
    setTimeout(callback, delay) {
      const timer = Symbol()
      timers.set(timer, { due: now + delay, callback })
      return timer
    },
    clearTimeout: (timer) => timers.delete(timer),
  })
  const render = () => { index = 0; effects = []; const value = useClassroom(id, owner); effects.forEach((effect) => effect()); return value }
  render()
  return { render, snapshot: (value) => handlers.onSnapshot(value), message: (channel, value) => handlers.onMessage(channel, value),
    error: (value) => handlers.onSyncError(value), setRoom(value) { id = value; render(); return render() },
    disconnect() { status = 'reconnecting'; render(); return render() },
    reconnect() { status = 'connected'; return render() },
    failPublish() { canPublish = false },
    sent, errors, timers, get syncId() { return syncId },
    stompError(code) { errors.forEach((listener) => listener({ code })) },
    advance(ms) {
      now += ms
      for (const [timer, { due, callback }] of timers) {
        if (due <= now) { timers.delete(timer); callback() }
      }
      return render()
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()) },
  }
}

const emptyStats = { '👍': 0, '❓': 0, '😀': 0, '👏': 0 }
const incomingReaction = (emoji, sentAt = time) => ({ type: 'REACTION', sentAt, emoji })

test('학생만 네 가지 반응을 STOMP로 보내고 서버에서 받은 이벤트만 화면에 표시한다', () => {
  const student = setup()
  const professor = setup(true)
  student.snapshot(state())
  professor.snapshot(state(true))
  for (const emoji of Object.keys(emptyStats)) {
    student.render().sendReaction(emoji)
    professor.render().sendReaction(emoji)
    assert.equal(student.render().reactions.length, 0)
  }
  assert.deepEqual(student.sent, Object.keys(emptyStats).map((emoji) => ['/app/rooms/40/reaction', JSON.stringify({ emoji })]))
  assert.deepEqual(professor.sent, [])

  for (const classroom of [student, professor]) {
    classroom.message('chat', incomingReaction('👍'))
    classroom.message('reaction', incomingReaction('😄'))
    classroom.message('reaction', incomingReaction('😀'))
    assert.deepEqual(Array.from(classroom.render().reactions, ({ emoji }) => emoji), ['😀'])
    assert.equal(classroom.advance(1_799).reactions.length, 1)
    assert.equal(classroom.advance(1).reactions.length, 0)
    assert.equal(classroom.timers.size, 0)
  }
})

test('교수 집계는 최초·재연결 state와 서버 감소 이벤트의 전체 값으로 교체된다', () => {
  const professor = setup(true)
  const nonzero = { ...emptyStats, '👍': 2 }
  professor.snapshot({ ...state(true), reactionStats: nonzero })
  assert.equal(professor.render().reactionStats, nonzero)
  professor.message('reaction', incomingReaction('👍'))
  assert.equal(professor.render().reactionStats, nonzero)
  professor.message('stats', { type: 'REACTION_STATS', reactionStats: { ...emptyStats, '😀': -1 } })
  assert.equal(professor.render().reactionStats, nonzero)
  professor.message('stats', { type: 'REACTION_STATS', reactionStats: emptyStats })
  assert.equal(professor.render().reactionStats, emptyStats)
  assert.equal(professor.disconnect().reactionStats, null)
  assert.equal(professor.render().reactions.length, 0)
  assert.equal(professor.reconnect().reactionStats, null)
  professor.snapshot({ ...state(true), reactionStats: nonzero })
  assert.equal(professor.render().reactionStats, nonzero)
  assert.equal(professor.setRoom(41).reactionStats, null)

  const student = setup()
  student.snapshot({ ...state(), reactionStats: nonzero })
  student.message('stats', { type: 'REACTION_STATS', reactionStats: nonzero })
  assert.equal(student.render().reactionStats, null)
})

test('제한·연결 끊김을 안내하고 방 이동과 언마운트 때 리스너와 타이머를 해제한다', () => {
  const student = setup()
  student.snapshot(state())
  student.render()
  assert.equal(student.errors.size, 1)
  student.stompError('QUESTION_CLOSED')
  assert.equal(student.render().realtimeNotice, undefined)
  student.stompError('RATE_LIMITED')
  assert.match(student.render().realtimeNotice, /요청이 너무 많습니다/)
  assert.equal(student.advance(4_000).realtimeNotice, undefined)

  student.disconnect().sendReaction('👏')
  assert.match(student.render().realtimeNotice, /연결이 끊겨/)
  student.reconnect()
  student.failPublish()
  student.render().sendReaction('👏')
  assert.equal(student.sent.length, 0)
  student.message('reaction', incomingReaction('❓'))
  student.render()
  assert.equal(student.timers.size, 2)
  assert.equal(student.setRoom(41).realtimeNotice, undefined)
  assert.equal(student.errors.size, 0)
  assert.equal(student.timers.size, 0)

  student.snapshot({ ...state(), room: { ...state().room, id: 41 } })
  student.render()
  student.stompError('RATE_LIMITED')
  student.render()
  assert.equal(student.errors.size, 1)
  assert.equal(student.timers.size, 1)
  student.unmount()
  assert.equal(student.errors.size, 0)
  assert.equal(student.timers.size, 0)
})

test('요청 검증·권한 오류를 공통으로 안내하고 STOMP 방 종료 오류에서 현재 수업을 닫는다', () => {
  const student = setup()
  student.snapshot(state())
  student.render()
  student.stompError('VALIDATION_FAILED')
  assert.match(student.render().realtimeNotice, /보낸 내용을 확인/)
  student.stompError('FORBIDDEN')
  assert.match(student.render().realtimeNotice, /권한이 없습니다/)
  assert.equal(student.syncId, 40)
  student.stompError('ROOM_CLOSED')
  const closed = student.render()
  assert.equal(closed.ended, true)
  assert.equal(closed.realtimeNotice, undefined)
  assert.equal(student.syncId, null)
  assert.equal(student.errors.size, 0)
  assert.equal(student.timers.size, 0)
  student.setRoom(41)
  assert.equal(student.syncId, 41)
})

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

test('고정 공지는 state로 시작해 고정·삭제·해제 메시지로 바뀌고 새 state와 방 이동에 맞춰 교체된다', () => {
  const pin = (id) => ({ id, senderParticipantId: 9, nickname: '학생이름', isOwner: false, content: `공지 ${id}`,
    parentId: null, parentPreview: null, createdAt: time })
  const student = setup()
  const ids = () => Array.from(student.render().pinned, ({ id }) => id)
  student.snapshot({ ...state(), pinnedMessages: [pin(1)] })
  assert.deepEqual(ids(), [1])
  student.message('chat', { type: 'NOTICE_PINNED', sentAt: time, message: pin(2) })
  student.message('chat', { type: 'NOTICE_PINNED', sentAt: time, message: pin(2) })
  student.message('reaction', { type: 'NOTICE_PINNED', sentAt: time, message: pin(9) })
  assert.deepEqual(ids(), [1, 2])
  student.message('chat', { type: 'MESSAGE_DELETED', sentAt: time, messageId: 1 })
  assert.deepEqual(ids(), [2])
  student.message('chat', { type: 'NOTICE_UNPINNED', sentAt: time, messageId: 2 })
  assert.deepEqual(ids(), [])
  student.message('chat', { type: 'NOTICE_PINNED', sentAt: time, message: pin(3) })
  student.snapshot({ ...state(), pinnedMessages: [pin(4), pin(5)] })
  assert.deepEqual(ids(), [4, 5])
  student.setRoom(41)
  assert.deepEqual(ids(), [])
})
