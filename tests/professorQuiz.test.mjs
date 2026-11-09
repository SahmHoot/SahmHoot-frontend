// #27 교수 퀴즈 화면: 서버 시각 계산, 메시지 → 화면 상태 전환, 결과 표시 계산
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

const clock = load('quiz/serverClock')
const quiz = load('quiz/professorQuizReducer', { './serverClock': clock })
const display = load('professor/dashboard-quiz')

const at = '2026-11-05T10:00:00Z'
const received = Date.parse(at) - 5000
const open = (no, runId = 7, q = 100 + no) => ({ type: 'QUESTION_OPENED', sentAt: at, runId, runQuestionId: q, questionNo: no, totalQuestions: 3,
  questionType: 'MULTIPLE_CHOICE', content: `문항 ${no}`, timeLimitSeconds: 10, closesAt: '2026-11-05T10:00:10Z', choices: [{ id: 1, orderNo: 1, content: 'a' }] })
const closed = (q, isLast = false) => ({ type: 'QUESTION_CLOSED', sentAt: at, runId: 7, runQuestionId: q, correctChoiceId: 1, isLast, nextOpensAt: '2026-11-05T10:00:13Z' })
const finished = (runId = 7) => ({ type: 'QUIZ_FINISHED', sentAt: at, runId, result: { questions: [] } })
const canceled = (runId = 7) => ({ type: 'QUIZ_CANCELED', sentAt: at, runId })
const waiting = { type: 'ROOM_WAITING', sentAt: at }
const progress = (q, n) => ({ type: 'ANSWER_PROGRESS', sentAt: at, runQuestionId: q, answeredCount: n })
const run = (state, ...messages) => messages.reduce((current, message) => quiz.professorQuizReducer(current, { kind: 'message', message, receivedAt: received }), state)

test('남은 시간은 기기 시계가 어긋나도 서버 시각 기준으로 계산한다', () => {
  const server = Date.parse(at)
  for (const skew of [0, 300_000, -300_000]) {
    const receivedAt = server - skew
    const offset = clock.clockOffsetMs(at, receivedAt)
    assert.equal(offset, skew)
    assert.equal(clock.remainingSeconds('2026-11-05T10:00:20Z', offset, receivedAt), 20)
    assert.equal(clock.remainingSeconds('2026-11-05T10:00:20Z', offset, receivedAt + 19_001), 1)
    assert.equal(clock.remainingSeconds('2026-11-05T10:00:20Z', offset, receivedAt + 20_000), 0)
    assert.equal(clock.remainingSeconds('2026-11-05T10:00:20Z', offset, receivedAt + 60_000), 0)
  }
  assert.equal(clock.clockOffsetMs('2026-11-05T10:00:00.123456789Z', server), 123)
})

test('열림 → 마감 → 다음 문항 → 결과 → 대기 순서로 바뀌고 정답은 저장하지 않는다', () => {
  let state = run(quiz.initialProfessorQuiz, open(1))
  assert.equal(state.phase, 'question')
  assert.equal(state.clockOffsetMs, 5000)
  state = run(state, progress(101, 2))
  assert.equal(state.answeredCount, 2)
  state = run(state, closed(101))
  assert.equal(state.phase, 'between')
  assert.equal(JSON.stringify(state).includes('correctChoiceId'), false)
  state = run(state, progress(101, 3))
  assert.equal(state.answeredCount, 3, '마감 직전 응답 집계는 3초 대기 중에도 반영한다')
  state = run(state, open(2))
  assert.equal(state.questionNo, 2)
  assert.equal(state.answeredCount, 0)
  state = run(state, closed(102), open(3), closed(103, true))
  assert.equal(state.isLast, true)
  state = run(state, finished())
  assert.equal(state.phase, 'results')
  assert.equal(run(state, waiting).phase, 'waiting')
})

test('중복·늦은·다른 회차 메시지는 이미 지난 단계로 되돌리지 않는다', () => {
  const first = run(quiz.initialProfessorQuiz, open(1))
  assert.equal(run(first, open(1)), first)
  assert.equal(run(first, progress(999, 9)), first)
  assert.equal(run(first, closed(999)), first)
  const between = run(first, closed(101))
  assert.equal(run(between, closed(101)), between)
  assert.equal(run(between, open(1)), between)
  const second = run(between, open(2))
  assert.equal(run(second, progress(101, 9)), second)
  const results = run(second, closed(102), open(3), closed(103, true), finished())
  assert.equal(run(results, finished()), results)
  assert.equal(run(results, open(3)), results)
  assert.equal(run(first, canceled(8)).phase, 'question')
  assert.equal(run(first, canceled()).phase, 'waiting')
  assert.equal(run(quiz.initialProfessorQuiz, canceled()), quiz.initialProfessorQuiz)
  assert.equal(run(run(quiz.initialProfessorQuiz, open(3)), open(1, 8, 500)).runId, 8)
  assert.equal(quiz.professorQuizReducer(first, { kind: 'reset' }), quiz.initialProfessorQuiz)
})

test('이전 회차의 늦은 열림·결과 메시지는 다음 회차 화면을 되돌리지 않는다', () => {
  const nextRun = run(quiz.initialProfessorQuiz, open(1, 8, 500), closed(500), open(2, 8, 501))
  assert.equal(nextRun.runId, 8)
  assert.equal(run(nextRun, open(1, 7, 100)), nextRun, '이전 회차의 열림은 무시한다')
  assert.equal(run(nextRun, finished(7)), nextRun, '이전 회차의 결과는 무시한다')
  const results = run(nextRun, finished(8))
  assert.equal(run(results, finished(7)), results, '결과를 보는 중에도 이전 회차의 결과는 무시한다')
  assert.equal(run(results, open(1, 7, 100)), results)
  assert.equal(run(results, open(1, 9, 600)).runId, 9, '더 새로운 회차는 받아들인다')
  assert.equal(run(quiz.initialProfessorQuiz, finished(7)).runId, 7, '대기 중에는 기준이 없어 그대로 받는다')
})

test('모르는 메시지는 무시한다', () => {
  for (const body of [{ type: 'REACTION_STATS' }, { type: 'ROOM_ENDED' }, 'x', null]) {
    assert.equal(quiz.toProfessorQuizMessage(body), null)
  }
  assert.ok(quiz.toProfessorQuizMessage(waiting))
})

test('결과 비율은 합이 100이고, 응답이 없으면 모두 0이다', () => {
  assert.deepEqual([...display.percentagesOf([0, 0, 0, 0])], [0, 0, 0, 0])
  assert.deepEqual([...display.percentagesOf([3, 0])], [100, 0])
  assert.deepEqual([...display.percentagesOf([1, 1, 1])], [34, 33, 33])
  assert.equal(display.percentagesOf([17, 7, 3, 1]).reduce((a, b) => a + b), 100)
})

test('선택지 표시는 개수로 OX와 객관식을 구분한다', () => {
  assert.equal(display.choiceLabel({ orderNo: 2, content: '큐' }, 4), '②')
  assert.equal(display.choiceLabel({ orderNo: 1, content: 'O' }, 4), '①')
  assert.equal(display.choiceLabel({ orderNo: 1, content: 'O' }, 2), 'O')
})

const snapshot = (quiz, extra = {}) => ({ serverTime: '2026-11-05T10:00:00.000500Z', quiz, ...extra })
const current = (no, closedAt = null) => ({ runQuestionId: 100 + no, questionNo: no, questionType: 'MULTIPLE_CHOICE', timeLimitSeconds: 10,
  content: `문항 ${no}`, choices: [{ id: 1, orderNo: 1, content: 'a' }], openedAt: at, closesAt: '2026-11-05T10:00:10Z', closedAt,
  correctChoiceId: closedAt ? 1 : null })
const restore = (state, snap) => quiz.professorQuizReducer(state, { kind: 'snapshot', snapshot: snap, receivedAt: Date.parse('2026-11-05T10:00:00Z') - 2000 })

test('새로고침하면 state로 대기·문항·3초·결과 화면을 다시 그린다', () => {
  const inQuestion = run(quiz.initialProfessorQuiz, open(1))
  assert.equal(restore(inQuestion, snapshot(null)).phase, 'waiting')

  const question = restore(quiz.initialProfessorQuiz, snapshot(
    { runId: 7, questionSetTitle: 's', totalQuestions: 3, phase: 'QUESTION', currentQuestion: current(2), nextOpensAt: null, result: null },
    { progress: { runQuestionId: 102, answeredCount: 4 } }))
  assert.equal(question.phase, 'question')
  assert.equal(question.questionNo, 2)
  assert.equal(question.answeredCount, 4)
  assert.equal(question.clockOffsetMs, 2000)

  const between = restore(quiz.initialProfessorQuiz, snapshot(
    { runId: 7, questionSetTitle: 's', totalQuestions: 3, phase: 'FEEDBACK', currentQuestion: current(3, at), nextOpensAt: '2026-11-05T10:00:03Z', result: null }))
  assert.equal(between.phase, 'between')
  assert.equal(between.isLast, true)
  assert.equal(between.answeredCount, 0)
  assert.equal(JSON.stringify(between).includes('correctChoiceId'), false, 'state의 정답은 옮기지 않는다')

  const result = { questions: [] }
  const results = restore(question, snapshot(
    { runId: 7, questionSetTitle: 's', totalQuestions: 3, phase: 'RESULT', currentQuestion: null, nextOpensAt: null, result }))
  assert.equal(results.phase, 'results')
  assert.equal(results.result, result)

  // 스냅샷 뒤 다음 메시지는 평소처럼 이어서 반영된다.
  assert.equal(run(question, closed(102)).phase, 'between')
})

test('서버 시각은 밀리초 아래까지 비교한다', () => {
  assert.equal(clock.compareServerTime('2026-11-05T10:00:00.000400Z', '2026-11-05T10:00:00.000500Z') < 0, true)
  assert.equal(clock.compareServerTime('2026-11-05T10:00:00.0005Z', '2026-11-05T10:00:00.000500Z'), 0)
  assert.equal(clock.compareServerTime('2026-11-05T10:00:01Z', '2026-11-05T10:00:00.999999Z') > 0, true)
  assert.equal(clock.compareServerTime('2026-11-05T10:00:00Z', '2026-11-05T10:00:00.000001Z') < 0, true)
})
