import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

// 결과 화면은 문항 번호 하나만 상태로 가지므로, useState 한 칸으로 렌더와 클릭을 흉내 낸다.
function screen(result, onClose = () => {}) {
  const state = { value: undefined }
  const react = { useState: (initial) => {
    state.value ??= initial
    return [state.value, (next) => { state.value = next }]
  } }
  const source = readFileSync(new URL('../src/features/professor/screens/QuizResults.tsx', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  const modules = {
    react, 'react/jsx-runtime': jsxRuntime, './QuizResults.css': {},
    'react-router-dom': { Navigate: () => null },
    '../dashboard-quiz': { choiceLabel: () => '', percentagesOf: (counts) => counts.map(() => 0) },
    '../components/JoinCode': { JoinCode: () => null },
    '../components/Chat': { Chat: () => null },
  }
  runInNewContext(outputText, { exports, require: (id) => {
    if (!(id in modules)) throw new Error(`Unexpected import: ${id}`)
    return modules[id]
  } })
  const render = () => exports.QuizResults({ room: { active: true }, result, chat: {}, reactions: [], notices: [],
    onUnpin() {}, onClose })
  const buttons = () => {
    const found = {}
    const walk = (node) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(walk)
      const { className, children } = node.props ?? {}
      if (node.type === 'button') found[className] = node.props
      walk(children)
    }
    walk(render())
    return found
  }
  const title = () => {
    let text
    const walk = (node) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(walk)
      if (node.props?.className === 'quiz-results__question-title') text = node.props.children
      walk(node.props?.children)
    }
    walk(render())
    return text
  }
  return { buttons, title }
}

const question = (no) => ({ runQuestionId: no, questionNo: no, content: `${no}번 문항`, correctChoiceId: 1,
  answeredCount: 0, correctCount: 0, incorrectCount: 0, choices: [{ id: 1, orderNo: 1, content: 'O', count: 0 }] })
const prev = 'quiz-results__prev-button'
const next = 'quiz-results__next-button'

test('교수 결과 화면은 이전·다음으로 문항을 오가고 첫 문항에서 이전, 마지막 문항에서 다음을 막는다', () => {
  const view = screen({ questions: [question(1), question(2), question(3)] })
  assert.equal(view.title(), '1번 문항')
  assert.equal(view.buttons()[prev].disabled, true)
  assert.equal(view.buttons()[next].disabled, false)

  view.buttons()[next].onClick()
  assert.equal(view.title(), '2번 문항')
  assert.equal(view.buttons()[prev].disabled, false)
  assert.equal(view.buttons()[next].disabled, false)

  view.buttons()[next].onClick()
  assert.equal(view.title(), '3번 문항')
  assert.equal(view.buttons()[next].disabled, true)

  view.buttons()[prev].onClick()
  view.buttons()[prev].onClick()
  assert.equal(view.title(), '1번 문항')
  assert.equal(view.buttons()[prev].disabled, true)
})

test('문항이 하나뿐이면 이전·다음 모두 막는다', () => {
  const view = screen({ questions: [question(1)] })
  assert.equal(view.buttons()[prev].disabled, true)
  assert.equal(view.buttons()[next].disabled, true)
})

test('버튼은 이전·다음·결과 닫기 순서이고 결과 닫기는 언제나 누를 수 있다', () => {
  let closed = 0
  const view = screen({ questions: [question(1), question(2)] }, () => { closed++ })
  assert.deepEqual(Object.keys(view.buttons()), [prev, next, 'quiz-results__close-button'])
  view.buttons()[next].onClick()
  assert.equal(view.buttons()['quiz-results__close-button'].disabled, undefined)
  view.buttons()['quiz-results__close-button'].onClick()
  assert.equal(closed, 1)
})
