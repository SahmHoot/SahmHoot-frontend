import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { createFixtureClient, installStorageCheck } from '../test-evidence/54-e2e/safety.mjs'

test('저장소 스냅샷은 브라우저 클로저에만 남고 boolean만 반환한다', () => {
  const browser = { window: {}, localStorage: { token: 'fake-jwt' }, sessionStorage: { secret: 'fake-password' } }
  assert.equal(runInNewContext(`(${installStorageCheck.toString()})()`, browser), true)
  assert.deepEqual(Object.keys(browser.window), ['review54StorageUnchanged'])
  assert.equal(browser.window.review54StorageUnchanged(), true)
  browser.localStorage.answers = '[1]'
  assert.equal(browser.window.review54StorageUnchanged(), false)
  delete browser.localStorage.answers
  assert.equal(browser.window.review54StorageUnchanged(), true)
  browser.sessionStorage.answers = '[2]'
  assert.equal(browser.window.review54StorageUnchanged(), false)
})

test('저장소 불일치 assertion 실패 로그에 JWT·쿠키·비밀번호가 출력되지 않는다', () => {
  const sentinel = ['FAKE_JWT_MUST_NOT_LEAK', 'FAKE_PASSWORD_MUST_NOT_LEAK', 'FAKE_COOKIE_MUST_NOT_LEAK']
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    import { runInNewContext } from 'node:vm'
    const browser = { window: {}, localStorage: { token: '${sentinel[0]}' },
      sessionStorage: { password: '${sentinel[1]}' }, document: { cookie: '${sentinel[2]}' } }
    runInNewContext(${JSON.stringify(`(${installStorageCheck.toString()})()`)}, browser)
    browser.localStorage.answers = '[1]'
    assert.equal(browser.window.review54StorageUnchanged(), true, 'Browser storage changed during review')
  `], { encoding: 'utf8' })
  assert.notEqual(child.status, 0, '실패 경로를 실제 실행해야 한다')
  const output = child.stdout + child.stderr
  assert.ok(output.includes('Browser storage changed during review'))
  for (const secret of sentinel) assert.ok(!output.includes(secret), '실패 로그에 민감한 값이 없어야 한다')
})

test('기존 세트 PATCH·DELETE·문항 POST는 전송 전에 거절한다', async () => {
  const calls = []
  const { api } = createFixtureClient(async (...args) => { calls.push(args); return { id: 54 } })
  for (const [path, method] of [['/question-sets/1', 'PATCH'], ['/question-sets/1', 'DELETE'], ['/question-sets/1/questions', 'POST']]) {
    await assert.rejects(api(path, 'fake-token', method), /not created/)
  }
  assert.equal(calls.length, 0)
  await api('/question-sets', 'fake-token', 'POST', { title: '이번 실행 세트' })
  await api('/question-sets/54/questions', 'fake-token', 'POST', {})
  await api('/question-sets/54', 'fake-token', 'PATCH', { visibility: 'PUBLIC' })
  await assert.rejects(api('/question-sets/54/../1', 'fake-token', 'PATCH'), /not created/)
  assert.equal(calls.length, 3)
})

test('제목이 같은 이전 실행 세트도 재사용하지 않으며 정리는 현재 생성 ID만 삭제한다', async () => {
  const calls = []
  const { api, cleanup } = createFixtureClient(async (path, token, method) => {
    calls.push([path, method])
    return { id: 54, title: '동일한 제목' }
  })
  await api('/question-sets', 'fake-token', 'POST', { title: '동일한 제목' })
  try {
    await assert.rejects(api('/question-sets/1', 'fake-token', 'PATCH'), /not created/)
    throw new Error('검증 도중 실패')
  } catch { /* 실제 runner와 같이 finally에서 현재 실행 자료만 정리한다. */ }
  finally { await cleanup('fake-token') }
  assert.deepEqual(calls, [['/question-sets', 'POST'], ['/question-sets/54', 'DELETE']])
  await assert.rejects(api('/question-sets/54', 'fake-token', 'PATCH'), /not created/)
  const nextRun = createFixtureClient(async () => { throw new Error('전송하면 안 됨') })
  await assert.rejects(nextRun.api('/question-sets/54', 'fake-token', 'DELETE'), /not created/)
})

test('일부 정리에 실패해도 다른 생성 자료의 정리를 계속하고 기존 ID는 건드리지 않는다', async () => {
  const deleted = []
  let next = 100
  const { api, cleanup } = createFixtureClient(async (path, token, method) => {
    if (method === 'POST') return { id: next++ }
    deleted.push(path)
    if (path.endsWith('/101')) throw new Error('정리 실패')
  })
  await api('/question-sets', 'fake-token', 'POST', {})
  await api('/question-sets', 'fake-token', 'POST', {})
  await assert.rejects(cleanup('fake-token'), /fixtures could not be removed/)
  assert.deepEqual(deleted, ['/question-sets/101', '/question-sets/100'])
})
