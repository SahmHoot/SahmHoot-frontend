import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

function load(path, dependencies = {}) {
  const source = readFileSync(new URL(`../src/features/${path}`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  runInNewContext(outputText, { exports, require: id => {
    if (id === 'react/jsx-runtime') return jsxRuntime
    if (id === 'react') return React
    if (id.endsWith('.css')) return {}
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`)
    return dependencies[id]
  } })
  return exports
}
const countdown = load('quiz/components/CountdownBar.tsx')
const image = { QuestionImage: () => null }
let seconds = 0
const professor = load('professor/components/QuizQuestion.tsx', {
  '../../quiz/hooks/useServerCountdown': { useServerCountdown: () => seconds },
  '../../quiz/components/CountdownBar': countdown, './Icon': { Icon: () => null },
  '../../../shared/components/QuestionImage': image,
})
const student = load('student/components/StudentQuizQuestion.tsx', {
  '../../../assets/student/timer.svg': { __esModule: true, default: 'timer.svg' },
  './AnswerRevealOverlay': { AnswerRevealOverlay: props => jsxRuntime.jsx('div', { 'data-testid': 'answer-overlay', 'data-correct': props.correct, children: props.answer }) },
  './StudentAnswerOptions': { __esModule: true, default: () => null }, '../../quiz/components/CountdownBar': countdown,
  '../../../shared/components/QuestionImage': image,
})
const question = { phase: 'question', runId: 1, runQuestionId: 10, questionNo: 3, totalQuestions: 4,
  content: '문제', choices: [], timeLimitSeconds: 60, closesAt: '', clockOffsetMs: 0, answeredCount: 0 }
const studentProps = { question: { title: '문제', options: [], correctAnswer: -1 }, index: 2, total: 4,
  phase: 'question', closesAt: '', clockOffsetMs: 0, timeLimitSeconds: 60, secondsLeft: 30, selected: null, onSelect() {} }
function bar(markup) {
  const tag = markup.match(/<div[^>]*role="progressbar"[^>]*>/)?.[0]
  assert.ok(tag)
  assert.match(tag, /aria-label="남은 시간"/)
  return { value: Number(tag.match(/aria-valuenow="([^"]*)"/)[1]), max: Number(tag.match(/aria-valuemax="([^"]*)"/)[1]) }
}
const renderProfessor = quiz => renderToStaticMarkup(jsxRuntime.jsx(professor.QuizQuestion, { quiz, participants: 5, onStop() {} }))
const renderStudent = props => renderToStaticMarkup(jsxRuntime.jsx(student.default, props))

test('교수·학생 남은 시간 바는 문항 번호와 무관하게 제한시간에서 0까지 줄어든다', () => {
  for (const remaining of [60, 30, 5, 0]) {
    seconds = remaining
    assert.deepEqual(bar(renderProfessor(question)), { value: remaining, max: 60 })
    assert.deepEqual(bar(renderStudent({ ...studentProps, secondsLeft: remaining })), { value: remaining, max: 60 })
  }
})

test('마감 후 다음 화면까지 3초가 남아도 답안 제출 시간 바는 0으로 유지한다', () => {
  seconds = 3
  const markup = renderProfessor({ ...question, phase: 'between', nextOpensAt: '', isLast: false })
  assert.deepEqual(bar(markup), { value: 0, max: 60 })
  assert.match(markup, /다음 문제까지 3초/)
  assert.deepEqual(bar(renderStudent({ ...studentProps, phase: 'feedback', secondsLeft: 3 })), { value: 0, max: 60 })
  assert.deepEqual(bar(renderStudent({ ...studentProps, phase: 'closing', secondsLeft: 0 })), { value: 0, max: 60 })
})

test('재연결한 긴 문항은 원래 제한시간을 분모로 쓰고 시각 보정 시 100%를 넘지 않는다', () => {
  seconds = 150
  assert.deepEqual(bar(renderProfessor({ ...question, timeLimitSeconds: 300 })), { value: 150, max: 300 })
  assert.deepEqual(bar(renderStudent({ ...studentProps, timeLimitSeconds: 300, secondsLeft: 150 })), { value: 150, max: 300 })
  seconds = 61
  assert.deepEqual(bar(renderProfessor(question)), { value: 60, max: 60 })
  assert.deepEqual(bar(renderStudent({ ...studentProps, secondsLeft: 61 })), { value: 60, max: 60 })
})

test('5초 이하 경고는 진행 중에만 표시하고 0초에는 서버 마감을 기다린다', () => {
  seconds = 5
  assert.match(renderProfessor(question), /data-urgent="true"/)
  assert.match(renderStudent({ ...studentProps, secondsLeft: 5 }), /data-urgent="true"/)
  assert.doesNotMatch(renderStudent({ ...studentProps, phase: 'feedback', secondsLeft: 3 }), /data-urgent="true"/)
  seconds = 0
  assert.match(renderProfessor(question), /마감 중/)
  assert.match(renderStudent({ ...studentProps, phase: 'closing', secondsLeft: 0 }), /마감 중/)
})

test('전체 화면 정답 연출은 서버 마감과 유효한 정답을 받은 뒤에만 표시한다', () => {
  const props = { ...studentProps, question: { title: 'OX', options: ['O', 'X'], correctAnswer: 0 }, selected: 0 }
  assert.doesNotMatch(renderStudent(props), /data-testid="answer-overlay"/)
  assert.doesNotMatch(renderStudent({ ...props, phase: 'closing' }), /data-testid="answer-overlay"/)
  assert.doesNotMatch(renderStudent({ ...props, phase: 'feedback', question: { ...props.question, correctAnswer: -1 } }), /data-testid="answer-overlay"/)
  const matched = renderStudent({ ...props, phase: 'feedback' })
  assert.match(matched, /data-testid="answer-overlay" data-correct="true">O</)
  assert.match(renderStudent({ ...props, phase: 'feedback', selected: 1 }), /data-correct="false"/)
})
