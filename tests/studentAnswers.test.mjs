// #30 학생 퀴즈 화면: 내 답 복원·변경·거부 되돌리기, 정답 공개, 회차 초기화
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(path) {
  const source = readFileSync(new URL(`../src/features/${path}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  const exports = {}
  runInNewContext(outputText, { exports, require: (id) => { throw new Error(`Unexpected dependency: ${id}`) } })
  return exports
}

const { studentAnswersReducer: reduce, initialStudentAnswers: initial, myAnswer } = load('student/studentAnswers')
const at = '2026-11-10T10:00:00Z'
const message = (body) => ({ kind: 'message', message: { sentAt: at, ...body }, receivedAt: 0 })
const open = (runId, runQuestionId = 11) => message({ type: 'QUESTION_OPENED', runId, runQuestionId, questionNo: 1 })
const select = (runQuestionId, choiceId) => ({ kind: 'select', runQuestionId, choiceId })
const snapshot = (quiz) => ({ kind: 'snapshot', snapshot: { quiz }, receivedAt: 0 })
const apply = (...actions) => actions.reduce(reduce, initial)

test('마감 전 답을 바꾸면 마지막 답이 내 답이다', () => {
  const state = apply(open(7), select(11, 1), select(11, 2))
  assert.equal(myAnswer(state, 11), 2)
  assert.equal(myAnswer(state, 12), null)
})

test('마감 뒤 거부된 답은 끝에서부터 되돌려 서버에 남은 답을 보인다', () => {
  let state = apply(open(7), select(11, 1), select(11, 2), select(11, 3))
  state = reduce(state, { kind: 'rejected' })
  assert.equal(myAnswer(state, 11), 2)
  state = reduce(reduce(state, { kind: 'rejected' }), { kind: 'rejected' })
  assert.equal(myAnswer(state, 11), null)
  assert.equal(reduce(state, { kind: 'rejected' }), state)
  assert.equal(reduce(initial, { kind: 'rejected' }), initial)
})

test('QUESTION_CLOSED의 정답을 문항별로 보관한다', () => {
  const state = apply(open(7), select(11, 2), message({ type: 'QUESTION_CLOSED', runId: 7, runQuestionId: 11, correctChoiceId: 1 }))
  assert.equal(state.correct[11], 1)
  assert.equal(myAnswer(state, 11), 2)
})

test('새로고침하면 state의 myAnswers와 피드백 정답으로 복원한다', () => {
  const state = apply(select(99, 5), snapshot({ runId: 7, phase: 'FEEDBACK',
    currentQuestion: { runQuestionId: 12, correctChoiceId: 4 },
    myAnswers: [{ runQuestionId: 11, choiceId: 1 }, { runQuestionId: 12, choiceId: 3 }] }))
  assert.equal(state.runId, 7)
  assert.equal(myAnswer(state, 11), 1)
  assert.equal(myAnswer(state, 12), 3)
  assert.equal(myAnswer(state, 99), null)
  assert.equal(state.correct[12], 4)
  // 복원 직후 오류가 와도 서버 값을 지우지 않는다.
  assert.equal(myAnswer(reduce(state, { kind: 'rejected' }), 12), 3)
})

test('진행 중 문항의 state에는 정답이 없고, 대기 state는 비운다', () => {
  const question = apply(snapshot({ runId: 7, phase: 'QUESTION', currentQuestion: { runQuestionId: 11, correctChoiceId: null } }))
  assert.deepEqual({ ...question.correct }, {})
  assert.equal(apply(open(7), select(11, 1), snapshot(null)), initial)
})

test('새 회차·대기 복귀·현재 회차 중단 때 내 답을 비우고 이전 회차 메시지는 무시한다', () => {
  const answered = apply(open(7), select(11, 1))
  assert.equal(myAnswer(reduce(answered, open(7, 12)), 11), 1)
  assert.equal(myAnswer(reduce(answered, open(8, 21)), 11), null)
  assert.equal(reduce(answered, open(6, 1)), answered)
  assert.equal(reduce(answered, message({ type: 'ROOM_WAITING' })), initial)
  assert.equal(reduce(answered, message({ type: 'QUIZ_CANCELED', runId: 6 })), answered)
  assert.equal(reduce(answered, message({ type: 'QUIZ_CANCELED', runId: 7 })), initial)
  assert.equal(reduce(answered, message({ type: 'QUIZ_FINISHED', runId: 7, result: { questions: [] } })), answered)
})
