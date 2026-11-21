import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const plain = (value) => JSON.parse(JSON.stringify(value))

function load(file, dependencies, globals = {}) {
  const source = readFileSync(new URL(`../src/features/auth/${file}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
  const exports = {}
  runInNewContext(outputText, { exports, ...globals, require: (id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`)
    return dependencies[id]
  } })
  return exports
}

/** 인증요청 버튼 클릭 이벤트. 이메일 칸 reportValidity 결과를 정한다. */
const click = (valid = true) => ({ currentTarget: { form: { querySelector: () => ({ reportValidity: () => valid }) } } })
const apiError = (code, message = code) => ({ status: 400, code, message })

function setup({ send = async () => {}, confirm = async () => {} } = {}) {
  const slots = []
  let index = 0
  let effects = []
  const timers = []
  const calls = []
  const changed = (slot, deps) => !slots[slot] || deps.some((value, i) => value !== slots[slot].deps[i])
  const react = {
    useState(initial) {
      const slot = index++
      if (!slots[slot]) {
        const cell = { value: typeof initial === 'function' ? initial() : initial }
        cell.set = (value) => { cell.value = typeof value === 'function' ? value(cell.value) : value }
        slots[slot] = cell
      }
      return [slots[slot].value, slots[slot].set]
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
  const globals = {
    setTimeout: (fn) => { timers.push(fn); return timers.length },
    clearTimeout: (id) => { timers[id - 1] = null },
  }
  const { useEmailVerification, RESEND_SECONDS } = load('hooks/useEmailVerification', {
    react, '../api': { toApiError: (error) => error },
  }, globals)
  let input = { email: 'User@Test.ac.kr ', code: '' }
  const render = () => {
    index = 0; effects = []
    const value = useEmailVerification({
      ...input,
      sendCode: async (email) => { calls.push(['send', email]); await send(email) },
      confirmCode: async (email, code) => { calls.push(['confirm', email, code]); await confirm(email, code) },
      sentMessage: '보냈습니다',
    })
    effects.forEach((effect) => effect())
    return value
  }
  render()
  return {
    render, calls, RESEND_SECONDS,
    set(next) { input = { ...input, ...next }; return render() },
    /** 1초 타이머를 하나 실행한다. */
    tick() { const i = timers.findIndex(Boolean); if (i >= 0) { const fn = timers[i]; timers[i] = null; fn() } return render() },
    async settle() { for (let i = 0; i < 3; i++) { await new Promise(setImmediate); render() } return render() },
  }
}

test('발송 성공 안내는 이메일 칸 아래 초록, 재요청은 30초 동안 막힌다', async () => {
  const hook = setup()
  hook.render().requestCode(click())
  const state = await hook.settle()
  assert.deepEqual(hook.calls, [['send', 'user@test.ac.kr']])
  assert.deepEqual(plain(state.emailMessage), { text: '보냈습니다', tone: 'success' })
  assert.equal(state.codeMessage, null)
  assert.equal(state.requested, true)
  assert.equal(state.cooldown, 30)
  assert.equal(hook.RESEND_SECONDS, 30)
  let left = state
  for (let i = 0; i < 30; i++) left = hook.tick()
  assert.equal(left.cooldown, 0)
  hook.tick()
  assert.equal(hook.render().cooldown, 0)
})

test('발송 실패는 이메일 칸 아래 빨강, 너무 잦은 요청은 30초 안내', async () => {
  const hook = setup({ send: async () => { throw apiError('VERIFICATION_TOO_FREQUENT') } })
  hook.render().requestCode(click())
  const state = await hook.settle()
  assert.equal(state.emailMessage.tone, 'error')
  assert.match(state.emailMessage.text, /30초에 한 번/)
  assert.equal(state.requested, false)
  assert.equal(state.cooldown, 0)
})

test('이메일 형식이 틀리면 요청하지 않는다', async () => {
  const hook = setup()
  hook.render().requestCode(click(false))
  await hook.settle()
  assert.deepEqual(hook.calls, [])
})

test('확인 결과는 인증 코드 칸 아래에 보이고, 완료되면 발송 안내를 지운다', async () => {
  let fail = true
  const hook = setup({ confirm: async () => { if (fail) throw apiError('VERIFICATION_CODE_INVALID', '남은 시도 4회') } })
  hook.render().verifyCode()
  assert.match(hook.render().codeMessage.text, /인증요청을 먼저/)

  hook.render().requestCode(click())
  await hook.settle()
  hook.set({ code: '12' }).verifyCode()
  assert.match(hook.render().codeMessage.text, /6자리/)

  hook.set({ code: '123456' }).verifyCode()
  let state = await hook.settle()
  assert.deepEqual(plain(state.codeMessage), { text: '남은 시도 4회', tone: 'error' })
  assert.equal(state.verified, false)

  fail = false
  hook.render().verifyCode()
  state = await hook.settle()
  assert.deepEqual(plain(state.codeMessage), { text: '이메일 인증이 완료되었습니다.', tone: 'success' })
  assert.equal(state.emailMessage, null)
  assert.equal(state.verified, true)
  assert.equal(state.canVerify, false)
  assert.deepEqual(hook.calls.at(-1), ['confirm', 'user@test.ac.kr', '123456'])
})

test('이메일을 바꾸면 인증이 풀리고 reset은 안내·재요청 대기를 지운다', async () => {
  const hook = setup()
  hook.render().requestCode(click())
  await hook.settle()
  hook.set({ code: '123456' }).verifyCode()
  assert.equal((await hook.settle()).verified, true)

  const changed = hook.set({ email: 'other@test.ac.kr' })
  assert.equal(changed.verified, false)
  assert.equal(changed.requested, false)

  changed.reset()
  const state = hook.render()
  assert.equal(state.emailMessage, null)
  assert.equal(state.codeMessage, null)
  assert.equal(state.cooldown, 0)
})
