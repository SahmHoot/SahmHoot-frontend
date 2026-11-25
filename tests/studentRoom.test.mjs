import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

function load(file, dependencies) {
  const source = readFileSync(new URL(`../src/features/${file}.tsx`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } })
  const exports = {}
  const modules = { react: React, 'react/jsx-runtime': jsxRuntime, ...dependencies }
  runInNewContext(outputText, { exports, window: { matchMedia: () => ({ matches: false }) }, require: (id) => {
    if (!(id in modules)) throw new Error(`Unexpected import: ${id}`)
    return modules[id]
  } })
  return exports
}

const none = { __esModule: true, default: () => null }
const composer = load('chat/ChatComposer', { './Chat.css': {}, '../../assets/student/send.svg': { __esModule: true, default: 'send.svg' } })
const StudentChat = load('student/components/StudentChat', {
  '../../../assets/student/pin.svg': { __esModule: true, default: 'pin.svg' },
  '../../../assets/student/reply.svg': { __esModule: true, default: 'reply.svg' },
  '../../../assets/student/send.svg': { __esModule: true, default: 'send.svg' },
  '../../room/ChatReactions': { ChatReactions: () => null },
  '../../chat/ChatComposer': composer,
  './StudentReactionBar': none,
  './StudentChat.css': {},
})

function renderRoom(classroom) {
  const { default: LiveStudentRoom } = load('student/screens/LiveStudentRoom', {
    'react-router-dom': { useNavigate: () => () => {} },
    '../../../shared/components/ConfirmDialog': { ConfirmDialog: () => null },
    '../../room/RoomEndedNotice': { RoomEndedNotice: () => null },
    '../../room/ClassroomStatus': { ClassroomStatus: () => null },
    '../../quiz/hooks/useServerCountdown': { useServerCountdown: () => 0 },
    '../components/StudentHeader': none,
    '../components/StudentChat': StudentChat,
    '../components/StudentQuizQuestion': none,
    '../components/StudentQuizResults': none,
    '../data/studentStorage': { writeSession() {} },
    '../hooks/useStudentQuiz': { useStudentQuiz: () => classroom },
    './StudentRoom.css': {},
  })
  return renderToStaticMarkup(jsxRuntime.jsx(LiveStudentRoom, { roomId: 40 }))
}

const message = (id, content, extra = {}) => ({ id, senderParticipantId: 3, nickname: '익명', isOwner: false,
  content, parentId: null, parentPreview: null, createdAt: '2026-11-19T00:00:00Z', ...extra })
const classroom = (pinned, recentMessages = []) => ({ quiz: { phase: 'waiting' }, onlineCount: 2, ended: false, error: '',
  snapshot: { room: { title: '실제 수업' }, me: { participantId: 9, nickname: '학생' }, recentMessages },
  pinned, reactions: [], realtimeNotice: undefined, sendReaction() {},
  chat: { messages: [...recentMessages].reverse(), received: 0, meId: 9, ready: true, blocked: false, sending: false, error: '' } })

test('학생 화면은 교수 답글 위에 원본 인용을 보여 주고 원본이 없는 메시지에는 붙이지 않는다', () => {
  const markup = renderRoom(classroom([], [
    message(2, '3장까지입니다', { senderParticipantId: 1, nickname: '교수', isOwner: true, parentId: 1, parentPreview: '시험 범위요?' }),
    message(1, '시험 범위요?'),
  ]))
  const replies = Array.from(markup.matchAll(/class="student-chat__reply"><img[^>]*\/>([^<]*)</g), ([, text]) => text)
  assert.deepEqual(replies, ['시험 범위요?'])
  assert.match(markup, /alt="답장"/)
  // 대기 중에도 채팅 제목 옆에 접속 인원을 보여 주고, 안내 문구는 두지 않는다.
  assert.match(markup, /<h2>실시간 채팅<\/h2><span>접속 2명<\/span>/)
  assert.doesNotMatch(markup, /내 메시지는|다음 안내를 기다려/)
  assert.ok(markup.indexOf('시험 범위요?') < markup.indexOf('3장까지입니다'))
})

test('학생 화면은 고정 공지를 고정한 순서로 모두 보여 주고 없으면 목록을 그리지 않는다', () => {
  const markup = renderRoom(classroom([message(8, '과제 마감'), message(5, '시험 범위')]))
  const notices = Array.from(markup.matchAll(/class="student-chat__notice"><img[^>]*\/><p>([^<]*)</g), ([, text]) => text)
  assert.deepEqual(notices, ['과제 마감', '시험 범위'])
  assert.match(markup, /교수 공지/)
  assert.ok(markup.includes('student-chat__notices'))
  assert.ok(!renderRoom(classroom([])).includes('student-chat__notices'))
})

test('교수 표시는 박스 대신 이름 뒤 텍스트로 표시하고 참가자에게는 붙이지 않는다', () => {
  const markup = renderRoom(classroom([], [
    message(2, '교수 안내', { nickname: '김교원', isOwner: true }),
    message(1, '교수 계정의 참가자 질문', { nickname: '참가교원', senderParticipantId: 9 }),
  ]))
  assert.match(markup, /class="student-chat__author">김교원 교수<\/p>/)
  assert.match(markup, /class="student-chat__author">참가교원 \(나\)<\/p>/)
  assert.doesNotMatch(markup, /student-chat__author[^>]*>[^<]*<span/)
})
