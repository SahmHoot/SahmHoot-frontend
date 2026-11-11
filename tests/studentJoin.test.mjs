import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const found = { roomId: 39, title: '서버 수업', ownerName: '담당 교수', status: 'OPEN', joined: false, isOwner: false, myNickname: null }
const joined = { roomId: 39, participantId: 91, nickname: '서버닉네임' }
const plain = (value) => JSON.parse(JSON.stringify(value))
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done }); return { promise, resolve } }

function load(file, dependencies, globals = {}) {
  const source = readFileSync(new URL(`../src/features/student/${file}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(outputText, { exports, ...globals, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`)
    return dependencies[id]
  } })
  return exports
}

function setup(code = '', overrides = {}) {
  const slots = []
  let index = 0
  let effects = []
  const navigation = []
  const sessions = []
  const calls = []
  const navigate = (...args) => navigation.push(plain(args))
  const changed = (slot, deps) => !slots[slot] || deps.some((value, i) => value !== slots[slot].deps[i])
  const react = {
    useState(initial) {
      const slot = index++
      if (!slots[slot]) {
        const cell = { value: initial }
        cell.set = (value) => { cell.value = typeof value === 'function' ? value(cell.value) : value }
        slots[slot] = cell
      }
      return [slots[slot].value, slots[slot].set]
    },
    useRef(initial) { const slot = index++; return slots[slot] ??= { current: initial } },
    useCallback(callback, deps) {
      const slot = index++
      if (changed(slot, deps)) slots[slot] = { value: callback, deps }
      return slots[slot].value
    },
    useEffect(effect, deps) {
      const slot = index++
      if (changed(slot, deps)) {
        slots[slot]?.cleanup?.()
        slots[slot] = { deps }
        effects.push(() => { slots[slot].cleanup = effect() })
      }
    },
  }
  const { useStudentJoin } = load('hooks/useStudentJoin', {
    react, 'react-router-dom': { useNavigate: () => navigate },
    '../../auth/api': { toApiError: (error) => error },
    '../data/studentStorage': { writeSession: (value) => sessions.push(plain(value)) },
    '../api': {
      getRoomByCode: async (value) => { calls.push(['lookup', value]); return found },
      joinRoom: async (...args) => { calls.push(['join', ...args]); return joined }, ...overrides,
    },
  })
  const render = () => { index = 0; effects = []; const value = useStudentJoin(code); effects.forEach((effect) => effect()); return value }
  render()
  return { render, navigation, sessions, calls,
    unmount() { slots.forEach((slot) => slot.cleanup?.()) },
    async settle() { for (let i = 0; i < 3; i++) { await new Promise(setImmediate); render() } return render() },
  }
}

test('입장 API는 공통 클라이언트로 코드를 조회하고 닉네임만 전송한다', async () => {
  const calls = []
  const api = load('api', { '../../shared/api/client': { apiClient: {
    get: async (path) => { calls.push(['GET', path]); return { data: found } },
    post: async (path, body) => { calls.push(['POST', path, plain(body)]); return { data: joined } },
  } } })
  assert.deepEqual(plain(await api.getRoomByCode('123456')), found)
  assert.deepEqual(plain(await api.joinRoom('123456', '학생이름')), joined)
  assert.deepEqual(calls, [['GET', '/rooms/by-code/123456'], ['POST', '/rooms/by-code/123456/participants', { nickname: '학생이름' }]])
})

test('수동 코드 검증 후 서버 수업을 표시하고 입장 응답의 닉네임과 ID로 이동한다', async () => {
  const hook = setup()
  for (const code of ['', '123', '12345a', '../123456']) {
    hook.render().setCode(code)
    await hook.render().enter()
    assert.match(hook.render().error, /6자리/)
  }
  assert.deepEqual(hook.calls, [])
  hook.render().setCode('123456')
  await hook.render().enter()
  assert.equal(hook.render().room.title, found.title)
  assert.deepEqual(hook.navigation, [])
  hook.render().setNickname('  가나  ')
  await hook.render().enter()
  assert.deepEqual(hook.calls, [['lookup', '123456'], ['join', '123456', '가나']])
  assert.deepEqual(hook.sessions, [{ code: '123456', nickname: joined.nickname, roomId: found.roomId, title: found.title }])
  assert.deepEqual(hook.navigation, [['/student/room/123456', { state: hook.sessions[0], replace: true }]])
})

test('QR 코드를 자동 조회하고 joined 응답이면 닉네임 입력과 POST 없이 재입장한다', async () => {
  const hook = setup('123456', { getRoomByCode: async () => ({ ...found, joined: true, myNickname: '기존이름' }) })
  await hook.settle()
  assert.equal(hook.sessions[0].nickname, '기존이름')
  assert.equal(hook.navigation[0][0], '/student/room/123456')
  assert.deepEqual(hook.calls, [])
})

test('나갔던 수업의 기존 닉네임을 채우고 재입장 응답의 이름을 따른다', async () => {
  const hook = setup('123456', { getRoomByCode: async () => ({ ...found, myNickname: '이전이름' }) })
  const state = await hook.settle()
  assert.equal(state.nickname, '이전이름')
  assert.equal(hook.navigation.length, 0)
  state.setNickname('다른이름')
  await hook.render().enter()
  assert.equal(hook.sessions[0].nickname, joined.nickname)
})

test('방 주인은 참가자로 입장하지 않고 교수 홈으로 이동한다', async () => {
  const hook = setup('123456', { getRoomByCode: async () => ({ ...found, isOwner: true }) })
  await hook.settle()
  assert.deepEqual(hook.navigation, [['/professor', { replace: true }]])
  assert.deepEqual(hook.sessions, [])
  assert.deepEqual(hook.calls, [])
})

test('닉네임 길이·문자·금지어를 검사하고 한글을 NFC로 정규화해 전송한다', async () => {
  const hook = setup('123456')
  await hook.settle()
  for (const nickname of [' ', '가', '가'.repeat(11), '교수님', '학생!', '😀😀']) {
    hook.render().setNickname(nickname)
    await hook.render().enter()
    assert.notEqual(hook.render().error, '')
  }
  assert.equal(hook.calls.filter(([kind]) => kind === 'join').length, 0)
  hook.render().setNickname('가나'.normalize('NFD'))
  await hook.render().enter()
  assert.deepEqual(hook.calls.at(-1), ['join', '123456', '가나'])
})

test('404·종료된 방·429 조회 오류를 안내하고 자동 재시도하거나 이동하지 않는다', async () => {
  for (const [code, expected] of [['ROOM_NOT_FOUND', /종료된/], ['ROOM_CLOSED', /종료된/], ['RATE_LIMITED', /잠시 후/]]) {
    let requests = 0
    const hook = setup('123456', { getRoomByCode: async () => { requests++; throw { code } } })
    assert.match((await hook.settle()).error, expected)
    assert.equal(hook.render().room, null)
    assert.equal(requests, 1)
    assert.deepEqual(hook.navigation, [])
  }
  const closed = setup('123456', { getRoomByCode: async () => ({ ...found, status: 'CLOSED' }) })
  assert.match((await closed.settle()).error, /종료된/)
})

test('중복 입장을 차단하고 409 후 입력을 보존해 다른 닉네임으로 재시도한다', async () => {
  let requests = 0
  const pending = deferred()
  const hook = setup('123456', { joinRoom: async () => {
    requests++
    if (requests === 1) { await pending.promise; throw { code: 'NICKNAME_ALREADY_USED' } }
    return joined
  } })
  await hook.settle()
  hook.render().setNickname('사용중이름')
  const first = hook.render().enter()
  await hook.render().enter()
  assert.equal(requests, 1)
  assert.equal(hook.render().pending, true)
  pending.resolve()
  await first
  assert.match(hook.render().error, /이미 사용 중/)
  assert.equal(hook.render().nickname, '사용중이름')
  assert.equal(hook.render().room.roomId, found.roomId)
  assert.equal(hook.render().pending, false)
  hook.render().setNickname('새로운이름')
  await hook.render().enter()
  assert.equal(requests, 2)
  assert.equal(hook.navigation.length, 1)
})

test('입장 중 종료·429·서버 오류를 구분하고 실패한 세션을 저장하지 않는다', async () => {
  for (const [code, expected] of [['ROOM_NOT_FOUND', /종료된/], ['RATE_LIMITED', /잠시 후/], ['NICKNAME_NOT_ALLOWED', /한글/], ['INTERNAL_ERROR', /서버 오류/]]) {
    const hook = setup('123456', { joinRoom: async () => { throw { code, message: '서버 오류' } } })
    await hook.settle()
    await hook.render().enter()
    assert.match(hook.render().error, expected)
    assert.deepEqual(hook.sessions, [])
    assert.deepEqual(hook.navigation, [])
  }
})

test('화면을 떠난 뒤 도착한 조회·입장 응답은 세션이나 이동을 바꾸지 않는다', async () => {
  const lookup = deferred()
  const first = setup('123456', { getRoomByCode: () => lookup.promise })
  first.unmount()
  lookup.resolve({ ...found, joined: true, myNickname: '이전이름' })
  await first.settle()
  assert.deepEqual(first.navigation, [])
  assert.deepEqual(first.sessions, [])
  const joining = deferred()
  const second = setup('123456', { joinRoom: () => joining.promise })
  await second.settle()
  const request = second.render().enter()
  second.unmount()
  joining.resolve(joined)
  await request
  assert.deepEqual(second.navigation, [])
  assert.deepEqual(second.sessions, [])
})

test('새로고침용 세션에 실제 방 ID·이름을 보존하고 잘못된 메타데이터는 거절한다', () => {
  let stored = null
  const storage = load('data/studentStorage', {}, { sessionStorage: {
    getItem: () => stored, setItem: (_, value) => { stored = value }, removeItem: () => { stored = null },
  } })
  const session = { code: '123456', nickname: '학생이름', roomId: 39, title: found.title }
  storage.writeSession(session)
  assert.deepEqual(plain(storage.readSession()), session)
  stored = JSON.stringify({ ...session, roomId: -1 })
  assert.equal(storage.readSession(), null)
  stored = JSON.stringify({ code: '123456', nickname: '미리보기' })
  assert.equal(storage.readSession().nickname, '미리보기')
})
