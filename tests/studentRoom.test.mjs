import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

function load(file, dependencies) {
  const source = readFileSync(new URL(`../src/features/${file.endsWith('.ts') ? file : `${file}.tsx`}`, import.meta.url), 'utf8')
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
const avatar = load('chat/ChatAvatar', { './Chat.css': {} })
const groups = load('chat/chatGroups.ts', {})
const replyQuote = load('chat/ChatReplyQuote', { './Chat.css': {} })
const composer = load('chat/ChatComposer', { './Chat.css': {}, '../../assets/student/send.svg': { __esModule: true, default: 'send.svg' } })
const StudentChat = load('student/components/StudentChat', {
  '../../../assets/student/pin.svg': { __esModule: true, default: 'pin.svg' },
  '../../../assets/student/send.svg': { __esModule: true, default: 'send.svg' },
  '../../room/ChatReactions': { ChatReactions: () => null },
  '../../chat/ChatAvatar': avatar,
  '../../chat/chatGroups': groups,
  '../../chat/ChatReplyQuote': replyQuote,
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

test('학생 화면은 교수 답글 말풍선 안에 받는 사람과 원문을 보여 주고 원본이 없는 메시지에는 붙이지 않는다', () => {
  const markup = renderRoom(classroom([], [
    message(2, '3장까지입니다', { senderParticipantId: 1, nickname: '교수', isOwner: true, parentId: 1, parentPreview: '시험 범위요?' }),
    message(1, '시험 범위요?'),
  ]))
  // 카카오톡처럼 말풍선 안 위쪽에 「원문 작성자에게 답장」과 원문 한 줄을 붙인다.
  const replies = Array.from(markup.matchAll(/class="chat-reply-quote__to">([^<]*)<\/span><span class="chat-reply-quote__text">([^<]*)</g), ([, to, text]) => [to, text])
  assert.deepEqual(replies, [['익명에게 답장', '시험 범위요?']])
  // 대기 중에도 채팅 제목 옆에 접속 인원을 보여 주고, 안내 문구는 두지 않는다.
  assert.match(markup, /<h2>실시간 채팅<\/h2><span>접속 2명<\/span>/)
  assert.doesNotMatch(markup, /내 메시지는|다음 안내를 기다려|대기 중/)
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
  // 이름 앞 동그라미는 닉네임 첫 글자이고, 교수는 기본색, 학생은 참가자 번호로 고른 색이다.
  assert.match(markup, /class="student-chat__author"><span class="chat-avatar" aria-hidden="true" style="background:#2538d2;color:white">김<\/span>김교원 교수<\/p>/)
  assert.match(markup, /class="student-chat__author"><span class="chat-avatar" aria-hidden="true" style="background:#9333ea;color:white">참<\/span>참가교원 \(나\)<\/p>/)
})

test('참가자 색은 번호마다 돌아가며 정해지고 교수는 늘 기본색이다', () => {
  assert.equal(avatar.avatarColor(3), avatar.avatarColor(10))
  assert.notEqual(avatar.avatarColor(3), avatar.avatarColor(4))
  assert.equal(avatar.avatarColor(3, true), '#2538d2')
})

test('수업 헤더는 「으로 참여 중」 없이 동그라미와 닉네임만 보여 준다', () => {
  const { default: StudentHeader } = load('student/components/StudentHeader', {
    'react-router-dom': { Link: ({ children }) => children },
    '../../../assets/brand/sahmhoot-symbol.svg': { __esModule: true, default: 'logo.svg' },
    '../../../assets/student/chevron-down.svg': { __esModule: true, default: 'chevron.svg' },
    '../../auth/AuthProvider': { useAuth: () => ({ user: null, signOut() {} }) },
    '../../chat/ChatAvatar': avatar,
    './StudentHeader.css': {},
  })
  const markup = renderToStaticMarkup(jsxRuntime.jsx(StudentHeader, { title: '실제 수업', nickname: '반짝이는 고래', participantId: 9 }))
  assert.match(markup, /<p class="student-header__me"><span class="student-header__avatar" aria-hidden="true" style="background:#9333ea;color:white">반<\/span><strong>반짝이는 고래<\/strong><\/p>/)
  assert.doesNotMatch(markup, /참여 중/)
})

test('같은 사람이 이어 보낸 메시지는 이름을 한 번만, 시간은 마지막 말풍선에만 붙인다', () => {
  const markup = renderRoom(classroom([], [
    message(3, '세 번째', { createdAt: '2026-11-19T00:00:40Z' }),
    message(2, '두 번째', { createdAt: '2026-11-19T00:00:20Z' }),
    message(1, '첫 번째'),
  ]))
  assert.equal(markup.match(/class="student-chat__author"/g).length, 1)
  assert.equal(markup.match(/<time /g).length, 1)
  assert.match(markup, /세 번째<\/p><time class="chat-time" dateTime="2026-11-19T00:00:40Z">(오전|오후) \d{1,2}:\d{2}<\/time>/)
  // 이어 붙은 말풍선도 화면 낭독기에는 보낸 사람을 읽어 준다.
  assert.match(markup, /<span class="chat-sr-only">익명: <\/span>두 번째/)
})

test('원문이 지금 목록에 없으면 받는 사람 없이 「답장」만, 삭제된 원문은 「삭제된 메시지」로 보여 준다', () => {
  const markup = renderRoom(classroom([], [
    message(4, '다시 안내합니다', { senderParticipantId: 1, nickname: '교수', isOwner: true, parentId: 99, parentPreview: null }),
  ]))
  assert.match(markup, /class="chat-reply-quote__to">답장<\/span><span class="chat-reply-quote__text">삭제된 메시지</)
})
