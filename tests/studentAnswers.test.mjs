// #30 학생 퀴즈 화면: 내 답 복원·변경·거부 되돌리기(문항 구분), 정답 공개, 회차 초기화
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

const openAt = (runQuestionId, closesAt) => message({ type: 'QUESTION_OPENED', runId: 7, runQuestionId, questionNo: 1, closesAt })
const close = (runQuestionId, correctChoiceId) => message({ type: 'QUESTION_CLOSED', runId: 7, runQuestionId, correctChoiceId })
const rejected = (sentAt) => ({ kind: 'rejected', sentAt })

test('앞 문항의 늦은 거부는 그 문항만 되돌리고 다음 문항의 답과 안내는 그대로 둔다', () => {
  let state = apply(openAt(11, '2026-11-10T10:01:00Z'), select(11, 1), select(11, 3), close(11, 1),
    openAt(12, '2026-11-10T10:02:00Z'), select(12, 5))
  // 12번이 아직 답을 받는 서버 시각에 온 거부는 11번에 늦게 도착한 3의 것이다.
  state = reduce(state, rejected('2026-11-10T10:01:30.123456Z'))
  assert.equal(myAnswer(state, 12), 5)
  assert.equal(myAnswer(state, 11), 1)
  assert.equal(state.rejectedQuestionId, 11)
})

test('열린 문항의 closesAt + 1초가 지난 거부는 그 문항의 마지막 답을 되돌린다', () => {
  const answered = apply(openAt(11, '2026-11-10T10:01:00Z'), select(11, 1), select(11, 2))
  const state = reduce(answered, rejected('2026-11-10T10:01:01.500Z'))
  assert.equal(myAnswer(state, 11), 1)
  assert.equal(state.rejectedQuestionId, 11)
  // 열린 문항이 아직 받는 시각인데 앞 문항에 보낸 답이 없으면 되돌릴 답이 없다.
  assert.equal(reduce(answered, rejected('2026-11-10T10:00:30Z')), answered)
})

test('조기 마감 뒤 거부는 방금 닫힌 문항의 것이다', () => {
  const state = reduce(apply(openAt(11, '2026-11-10T10:01:00Z'), select(11, 1), select(11, 2), close(11, 1)),
    rejected('2026-11-10T10:00:30Z'))
  assert.equal(myAnswer(state, 11), 1)
})

const liveState = (runQuestionId, choiceId, phase = 'QUESTION') => snapshot({ runId: 7, phase,
  currentQuestion: { runQuestionId, closesAt: '2026-11-10T10:01:00Z', correctChoiceId: phase === 'FEEDBACK' ? 1 : null },
  myAnswers: choiceId === null ? [] : [{ runQuestionId, choiceId }] })

test('재연결 state가 그 뒤 고른 답보다 오래됐으면 열린 문항의 내 답을 유지하고 다시 보낼 답으로 둔다', () => {
  // ②를 보내 state로 확인된 뒤 ①로 바꿨는데, ①보다 먼저 만들어진 state(②)가 늦게 도착했다.
  const state = apply(openAt(11, '2026-11-10T10:01:00Z'), select(11, 2), liveState(11, 2), select(11, 1), liveState(11, 2))
  assert.equal(myAnswer(state, 11), 1)
  assert.deepEqual({ ...state.resend }, { runQuestionId: 11, choiceId: 1 })
  // 다시 보낸 답마저 마감으로 거부되면 서버에 남은 ②로 돌아간다.
  assert.equal(myAnswer(reduce(state, rejected('2026-11-10T10:01:02Z')), 11), 2)
})

test('state가 내 답과 같거나 문항이 마감됐으면 서버 값을 따르고 다시 보내지 않는다', () => {
  const sentOne = apply(openAt(11, '2026-11-10T10:01:00Z'), select(11, 2), select(11, 1))
  const confirmed = reduce(sentOne, liveState(11, 1))
  assert.equal(myAnswer(confirmed, 11), 1)
  assert.equal(confirmed.resend, null)
  // 확인된 뒤로 이 탭에서 보낸 답이 없으면 바뀐 서버 값(다른 탭 등)을 따른다.
  assert.equal(myAnswer(reduce(confirmed, liveState(11, 3)), 11), 3)
  // 끊긴 동안 보낸 답이 사라진 채 마감됐으면 서버 값(미응답)이 맞다.
  const closed = reduce(sentOne, liveState(11, null, 'FEEDBACK'))
  assert.equal(myAnswer(closed, 11), null)
  assert.equal(closed.resend, null)
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
