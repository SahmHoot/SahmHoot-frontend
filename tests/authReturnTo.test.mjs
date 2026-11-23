import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

function load(path, dependencies, globals = {}) {
  // CommonJS로 옮기면 import.meta를 쓸 수 없어 Vite 환경값(운영 빌드)을 넣는다.
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
    .replaceAll('import.meta.env.DEV', 'false')
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } })
  const exports = {}
  runInNewContext(outputText, { exports, ...globals, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return exports
}

function storage() {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

/** 실제 session.ts와 RequireAuth. 인증 상태와 라우터 위치만 바꿔 가며 렌더한다. */
function setup() {
  const auth = { status: 'signedIn', user: { role: 'STUDENT' }, signedOutKey: null }
  const location = { pathname: '/student', search: '', key: 'student-home' }
  const session = load('features/auth/session.ts', {
    '../../shared/api/client': { tokenStorage: { get: () => null, set() {}, clear() {} } },
  }, { sessionStorage: storage() })
  const { RequireAuth } = load('features/auth/components/RequireAuth.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-router-dom': { Navigate: () => null, useLocation: () => location },
    '../AuthProvider': { useAuth: () => auth },
    '../session': session,
    './AuthUnavailable': { AuthUnavailable: () => null },
  })
  /** useLogin과 같은 규칙으로 로그인 뒤 갈 주소를 정한다. */
  const afterLogin = (role) => session.takeReturnTo() ?? session.homePath(role)
  return { auth, location, session, RequireAuth, afterLogin }
}

test('#127: 학생 화면에서 로그아웃하고 교수로 로그인하면 교수 홈으로 간다', () => {
  const { auth, location, RequireAuth, afterLogin } = setup()
  assert.equal(RequireAuth({ children: 'student-home' }), 'student-home')
  // signOut 직후: 라우터 이동이 반영되기 전이라 같은 화면이 로그아웃 상태로 한 번 더 그려진다.
  Object.assign(auth, { status: 'signedOut', user: null, signedOutKey: 'student-home' })
  assert.equal(RequireAuth({ children: 'student-home' }).props.to, '/login')
  assert.equal(afterLogin('PROFESSOR'), '/professor')
})

test('RM-09: 로그아웃 직후 로그인 화면보다 먼저 다른 위치(뒤로 가기한 QR 주소)가 그려지면 그 주소는 저장한다', () => {
  const { auth, location, RequireAuth, afterLogin } = setup()
  Object.assign(auth, { status: 'signedOut', user: null, signedOutKey: 'student-home' })
  Object.assign(location, { pathname: '/join/412833', search: '?from=qr', key: 'qr-entry' })
  RequireAuth({ children: 'join' })
  assert.equal(afterLogin('PROFESSOR'), '/join/412833?from=qr')
})

test('RM-09: 로그아웃 상태로 QR 주소에 들어오면 로그인 뒤 그 주소로 돌아간다', () => {
  const { auth, location, RequireAuth, afterLogin } = setup()
  Object.assign(auth, { status: 'signedOut', user: null, signedOutKey: null })
  location.pathname = '/join/412833'
  location.search = '?from=qr'
  assert.equal(RequireAuth({ children: 'join' }).props.to, '/login')
  assert.equal(afterLogin('PROFESSOR'), '/join/412833?from=qr')
})

test('실제 session.ts: clearReturnTo는 saveReturnTo로 보관한 주소를 지운다', () => {
  const { session, afterLogin } = setup()
  session.saveReturnTo('/join/412833')
  session.clearReturnTo()
  assert.equal(afterLogin('PROFESSOR'), '/professor')
})

/** AuthProvider를 훅 흉내로 렌더한다. 렌더 중 상태를 바꾸면 다시 렌더하고, effect는 커밋 뒤에 돌린다. */
function provider({ token = null, previewRole = null } = {}) {
  const slots = []
  const refs = []
  let effects = []
  const navigations = []
  const sharedListeners = []
  const location = { pathname: '/student', search: '', key: 'student-home' }
  const store = storage()
  let index = 0
  let refIndex = 0
  let dirty = false
  const react = {
    createContext: () => ({ Provider: 'AuthContext.Provider' }),
    useContext: () => null,
    useState(initial) {
      const slot = index++
      if (!slots[slot]) {
        const cell = { value: typeof initial === 'function' ? initial() : initial }
        cell.set = (value) => {
          const next = typeof value === 'function' ? value(cell.value) : value
          if (next !== cell.value) dirty = true
          cell.value = next
        }
        slots[slot] = cell
      }
      return [slots[slot].value, slots[slot].set]
    },
    useRef(initial) {
      const slot = refIndex++
      refs[slot] ??= { current: initial }
      return refs[slot]
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (fn) => effects.push(fn),
  }
  const session = {
    clearSession() { token = null; previewRole = null },
    getAccessToken: () => token,
    getPreviewRole: () => previewRole,
    saveReturnTo: (path) => store.setItem('returnTo', path),
    clearReturnTo: () => store.removeItem('returnTo'),
    saveSession() {},
  }
  const { AuthProvider } = load('features/auth/AuthProvider.tsx', {
    react,
    'react/jsx-runtime': jsxRuntime,
    'react-router-dom': { useNavigate: () => (to) => navigations.push(to), useLocation: () => ({ ...location }) },
    '../../shared/api/client': { setUnauthorizedHandler() {}, tokenStorage: { onSharedChange: (fn) => { sharedListeners.push(fn); return () => {} } } },
    '../../shared/stomp': { configureStomp() {}, disconnectStomp: async () => {} },
    './api': { fetchMe: () => new Promise(() => {}), isUnauthorized: () => false },
    './session': session,
  })
  /** 한 번 커밋할 때까지 렌더하고 effect를 돌린다. effect가 상태를 바꾸면 다시 커밋한다. */
  const commit = () => {
    let value
    do {
      do {
        dirty = false
        index = 0
        refIndex = 0
        effects = []
        value = AuthProvider({ children: null }).props.value
      } while (dirty)
      effects.forEach((fn) => fn())
    } while (dirty)
    return value
  }
  return { commit, location, navigations, sharedListeners, returnTo: () => store.getItem('returnTo'),
    saveReturnTo: session.saveReturnTo, // 두 번째 useState가 status다.
    setStatus: (status) => { if (!slots[1]) commit(); slots[1].set(status) } }
}

test('#127: signOut은 그 화면의 위치 키를 알리고, 다른 위치로 이동이 반영되면 지운다', () => {
  const { commit, location, navigations, setStatus } = provider({ token: 'test-token' })
  setStatus('signedIn')
  commit().signOut()
  // 라우터 이동은 아직 반영되지 않아 이전 화면 위치로 커밋된다.
  const during = commit()
  assert.equal(during.status, 'signedOut')
  assert.equal(during.signedOutKey, 'student-home')
  assert.deepEqual(navigations, ['/login'])
  Object.assign(location, { pathname: '/login', key: 'login' })
  assert.equal(commit().signedOutKey, null)
})

test('#127: 로그인해 있던 계정이 로그아웃하면 남아 있던 돌아갈 주소를 버린다', () => {
  const { commit, returnTo, saveReturnTo, setStatus } = provider({ token: 'test-token' })
  saveReturnTo('/join/412833')
  setStatus('signedIn')
  commit().signOut()
  assert.equal(returnTo(), null)
})

test('RM-09: 다른 탭의 로그아웃(401 만료일 수 있음)은 돌아갈 주소 저장을 막지 않는다', () => {
  const { commit, returnTo, saveReturnTo, sharedListeners, setStatus } = provider()
  saveReturnTo('/join/412833')
  setStatus('signedIn')
  commit()
  sharedListeners[0]()
  const value = commit()
  assert.equal(value.status, 'signedOut')
  assert.equal(value.signedOutKey, null)
  assert.equal(returnTo(), '/join/412833')
})

test('#127: 화면 미리보기에서 로그아웃해도 돌아갈 주소를 버린다', () => {
  const { commit, returnTo, saveReturnTo } = provider({ previewRole: 'STUDENT' })
  saveReturnTo('/join/412833')
  commit().signOut()
  assert.equal(returnTo(), null)
})

test('RM-09: 로그인하지 않은 채 비밀번호를 재설정하면(signOut) QR 주소를 남긴다', () => {
  const { commit, returnTo, saveReturnTo } = provider()
  saveReturnTo('/join/412833')
  commit().signOut()
  assert.equal(returnTo(), '/join/412833')
})
