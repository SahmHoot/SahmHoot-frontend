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
  runInNewContext(outputText, { exports, require: (id) => {
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
  const classroom = { useClassroom: (_roomId, _owner, onQuizAction) => { forward = onQuizAction; return { quiz } } }
  const answers = load('student/studentAnswers')
  const { useStudentQuiz } = load('student/hooks/useStudentQuiz', {
    react, '../../../shared/stomp': stomp, '../../room/useClassroom': classroom, '../studentAnswers': answers,
  })
  const render = () => { index = 0; return useStudentQuiz(40) }
  return {
    sent, stomp, render,
    open(runQuestionId) {
      quiz = { phase: 'question', runId: 7, runQuestionId }
      forward({ kind: 'message', message: { type: 'QUESTION_OPENED', runId: 7, runQuestionId, questionNo: 1 }, receivedAt: 0 })
    },
    close() { quiz = { ...quiz, phase: 'between' } },
    error: (code) => errorListeners.forEach((listener) => listener({ type: 'ERROR', code, message: '', sentAt: '' })),
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
