import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import axios from 'axios'
import * as jsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
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

function setup() {
  const client = load('shared/api/client.ts', { axios: { default: axios } }, {
    sessionStorage: storage(), localStorage: storage(),
  })
  const api = load('features/questionset/api.ts', { axios, '../../shared/api/client': client })
  return { ...client, api }
}

test('실제 공통 인터셉터: 목록·상세·모든 변경 API에 현재 JWT를 자동 첨부한다', async () => {
  const { apiClient, tokenStorage, api } = setup()
  const calls = []
  apiClient.defaults.adapter = async (config) => {
    calls.push(config)
    return { config, data: {}, status: 200, statusText: 'OK', headers: {} }
  }
  tokenStorage.set('test-session-token', false)
  await api.getMyQuestionSets()
  await api.getQuestionSet(63)
  await api.createQuestionSet({ title: '세트', visibility: 'PRIVATE' })
  await api.updateQuestionSet(63, { title: '수정' })
  await api.deleteQuestionSet(63)
  await api.addQuestion(63, {})
  await api.updateQuestion(63, 1, {})
  await api.deleteQuestion(63, 1)
  await api.reorderQuestions(63, { questionIds: [1] })
  assert.equal(calls.length, 9)
  for (const call of calls) {
    assert.equal(call.baseURL, '/api')
    assert.equal(call.headers.Authorization, 'Bearer test-session-token')
  }
  tokenStorage.set('test-replaced-token', false)
  await api.getMyQuestionSets()
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer test-replaced-token')
})

test('실제 공통 인터셉터: 401에서 인증 만료를 알리고 POST/PATCH/PUT/DELETE를 한 번만 전송한다', async () => {
  const { apiClient, tokenStorage, setUnauthorizedHandler, api } = setup()
  let requests = 0
  let expired = 0
  setUnauthorizedHandler(() => { expired++; tokenStorage.clear() })
  apiClient.defaults.adapter = async (config) => {
    requests++
    throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null,
      { config, status: 401, data: { code: 'UNAUTHORIZED', message: '로그인 필요' }, headers: {} })
  }
  const operations = [() => api.createQuestionSet({}), () => api.updateQuestionSet(63, {}),
    () => api.deleteQuestionSet(63), () => api.addQuestion(63, {}),
    () => api.updateQuestion(63, 1, {}), () => api.deleteQuestion(63, 1),
    () => api.reorderQuestions(63, { questionIds: [1] })]
  for (const [index, operation] of operations.entries()) {
    tokenStorage.set('test-token', false)
    await assert.rejects(operation(), (error) => api.toQuestionSetApiError(error).status === 401)
    assert.equal(requests, index + 1)
    assert.equal(expired, index + 1)
    assert.equal(tokenStorage.get(), null)
  }
})

test('공통 인증 경계: 로그인 실패·이전 토큰의 늦은 401은 현재 인증을 만료시키지 않는다', async () => {
  const { apiClient, tokenStorage, setUnauthorizedHandler, api } = setup()
  let expired = 0
  let code = 'INVALID_CREDENTIALS'
  setUnauthorizedHandler(() => { expired++ })
  tokenStorage.set('test-old-token', false)
  apiClient.defaults.adapter = async (config) => {
    if (code === 'UNAUTHORIZED') tokenStorage.set('test-new-token', false)
    throw new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null,
      { config, status: 401, data: { code }, headers: {} })
  }
  await assert.rejects(api.getMyQuestionSets())
  code = 'UNAUTHORIZED'
  await assert.rejects(api.getMyQuestionSets())
  assert.equal(expired, 0)
  assert.equal(tokenStorage.get(), 'test-new-token')
})

test('실제 RequireAuth: 교수 전용 경로를 제한하고 교수의 참가자 경로는 허용한다', () => {
  let status = 'signedIn'
  let role = 'STUDENT'
  const returns = []
  const { RequireAuth } = load('features/auth/components/RequireAuth.tsx', {
    'react/jsx-runtime': jsxRuntime,
    'react-router-dom': { Navigate: () => null, useLocation: () => ({ pathname: '/professor/sets/63', search: '' }) },
    '../AuthProvider': { useAuth: () => ({ status, user: status === 'signedIn' ? { role } : null }) },
    '../session': { getPreviewRole: () => null, homePath: (role) => role === 'PROFESSOR' ? '/professor' : '/student',
      saveReturnTo: (path) => returns.push(path) },
    './AuthUnavailable': { AuthUnavailable: () => null },
  })
  assert.equal(RequireAuth({ role: 'PROFESSOR', children: 'editor' }).props.to, '/student')
  role = 'PROFESSOR'
  assert.equal(RequireAuth({ role: 'PROFESSOR', children: 'editor' }), 'editor')
  assert.equal(RequireAuth({ children: 'join' }), 'join')
  status = 'signedOut'
  assert.equal(RequireAuth({ role: 'PROFESSOR', children: 'editor' }).props.to, '/login')
  assert.deepEqual(returns, ['/professor/sets/63'])
})
