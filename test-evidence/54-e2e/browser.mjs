import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { createFixtureClient, installStorageCheck } from './safety.mjs'

// 실행마다 새 세트를 생성하고, safety.mjs가 그 ID에 대한 변경만 허용한다.
const base = process.env.REVIEW54_API ?? 'http://127.0.0.1:8081/api'
const origin = process.env.REVIEW54_ORIGIN ?? 'http://localhost:5173'
const seed = readFileSync(new URL('../../../SahmHoot-backend-54/src/main/java/com/sahmhoot/seed/LocalSeedRunner.java', import.meta.url), 'utf8')
const password = seed.match(/PASSWORD = "([^"]+)"/)[1]
let stage = 'fixtures'
async function request(path, token, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }, body: body ? JSON.stringify(body) : undefined })
  const data = response.status === 204 ? undefined : await response.json()
  if (!response.ok) throw new Error('Fixture API request failed')
  return data
}
async function run() {
  const { api, cleanup } = createFixtureClient(request)
  let token
  let ws
  const runId = randomUUID().slice(0, 8)
  const output = new URL('runs/' + new Date().toISOString().replace(/[:.]/g, '-') + '/', import.meta.url)
  mkdirSync(output, { recursive: true })
  try {
    const professor = await api('/auth/login', null, 'POST', { email: 'professor@local.test', password })
    const student = await api('/auth/login', null, 'POST', { email: 'student1@local.test', password })
    token = professor.accessToken
    const beforeExisting = await api('/question-sets/mine', token)
    const sample = await api('/question-sets', token, 'POST', { title: '[54 검증 ' + runId + '] 컴퓨터 기초', visibility: 'PRIVATE' })
    await api('/question-sets/' + sample.id + '/questions', token, 'POST', {
      type: 'MULTIPLE_CHOICE', content: '다음 중 FIFO 방식의 자료구조는 무엇인가요?', timeLimitSeconds: 60,
      choices: ['스택', '큐', '트리', '그래프'].map((content, i) => ({ content, isCorrect: i === 1 })),
    })
    await api('/question-sets/' + sample.id + '/questions', token, 'POST', {
      type: 'TRUE_FALSE', content: '스택은 LIFO 방식의 자료구조이다.', timeLimitSeconds: 30,
      choices: [{ content: 'O', isCorrect: true }, { content: 'X', isCorrect: false }],
    })
    const emptySet = await api('/question-sets', token, 'POST', { title: '[54 검증 ' + runId + '] 빈 세트', visibility: 'PUBLIC' })
    for (let i = 0; i < 20; i++) {
      await api('/question-sets', token, 'POST', { title: '[54 검증 ' + runId + '] 공개 목록 ' + (i + 1), visibility: 'PUBLIC' })
    }
    const privateSet = await api('/question-sets', token, 'POST', { title: '[54 검증 ' + runId + '] 비공개', visibility: 'PRIVATE' })
    await api('/question-sets/' + sample.id, token, 'PATCH', { visibility: 'PUBLIC' })
    const sampleDetail = await api('/question-sets/' + sample.id, student.accessToken)
    const publicSets = await api('/question-sets/public', student.accessToken)
    assert.equal(publicSets.content.length, 20)
    assert.ok(!publicSets.content.some(set => set.id === privateSet.id))
    const secondPage = await api('/question-sets/public?page=1&size=20', student.accessToken)
    assert.ok(secondPage.content.length > 0)
    assert.ok(!secondPage.content.some(set => set.id === privateSet.id))

    const targets = await (await fetch(`http://127.0.0.1:${process.env.CDP_PORT ?? 9254}/json/list`)).json()
    ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
    let sequence = 0
    const pending = new Map()
    const requests = []
    const statuses = []
    let fetchHandler
    let documentLoaded
    let exceptionCount = 0
    ws.onmessage = event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const task = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) task.reject(new Error('Browser command failed'))
        else task.resolve(message.result)
      }
      if (message.method === 'Network.requestWillBeSent' && message.params.request.url.includes('/api/')) {
        const { url, method } = message.params.request
        requests.push({ path: new URL(url).pathname + new URL(url).search, method })
      }
      if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/api/')) {
        const { url, status } = message.params.response
        statuses.push({ path: new URL(url).pathname, status })
      }
      if (message.method === 'Fetch.requestPaused' && fetchHandler) {
        void fetchHandler(message.params).catch(() => { exceptionCount++ })
      }
      if (message.method === 'Runtime.exceptionThrown') exceptionCount++
      if (message.method === 'Page.loadEventFired') documentLoaded?.()
    }
    function cdp(method, params = {}) {
      const id = ++sequence
      return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
    }
    async function evaluate(expression) {
      const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      if (result.exceptionDetails) throw new Error('Browser evaluation failed')
      return result.result.value
    }
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
    async function until(expression) {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100) }
      throw new Error('UI check timed out')
    }
    async function text(value) { await until(`document.body.innerText.includes(${JSON.stringify(value)})`) }
    async function loadDocument(method, params) {
      let timeout
      const loaded = new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Document load timed out')), 10000)
        documentLoaded = resolve
      })
      try { await cdp(method, params); await loaded }
      finally { clearTimeout(timeout); documentLoaded = undefined }
    }
    async function goto(path) { await loadDocument('Page.navigate', { url: origin + path }) }
    async function button(label) {
      const clicked = await evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!b || b.disabled) return false; b.click(); return true })()`)
      assert.equal(clicked, true, `활성 버튼: ${label}`)
    }
    async function shot(name) {
      const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      writeFileSync(new URL(name, output), Buffer.from(result.data, 'base64'))
    }
    async function noOverflow() {
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, '가로 넘침 없음')
    }

    try {
      await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable')
      await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
      await goto('/health'); await until('location.pathname === "/health" && document.readyState === "complete"')
      await evaluate('localStorage.clear(); sessionStorage.clear()')
      await goto('/login'); await until('!!document.querySelector("input[type=email]")')
      for (const [selector, value] of [['input[type=email]', 'student1@local.test'], ['input[type=password]', password]]) {
        await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
        await cdp('Input.insertText', { text: value })
      }
      await evaluate('document.querySelector("button[type=submit]").click()')
      await text('다시 풀어보기')
      await until('document.querySelectorAll(".student-review-list__item").length === 20')
      await noOverflow(); await shot('01-public-list-mobile.png')
      stage = 'public-list-pagination'
      await button('다음'); await until('document.querySelector(".student-review-list__pages span").textContent.startsWith("2 /")')
      await until('document.querySelectorAll(".student-review-list__item").length > 0')
      await button('이전'); await until('document.querySelector(".student-review-list__pages span").textContent.startsWith("1 /")')
      for (let page = 0; page < publicSets.totalPages; page++) {
        await until('document.querySelectorAll(".student-review-list__item").length > 0')
        if (await evaluate(`!!document.querySelector('a[href="/student/review/${sample.id}"]')`)) break
        await button('다음')
        await until(`document.querySelector('.student-review-list__pages span').textContent.startsWith('${page + 2} /')`)
      }
      assert.equal(await evaluate(`!!document.querySelector('a[href="/student/review/${sample.id}"]')`), true)
      await evaluate(`document.querySelector('a[href="/student/review/${sample.id}"]').click()`)
      await text(sampleDetail.questions[0].content)
      stage = 'review-answers'
      const reviewStart = requests.length
      assert.equal(await evaluate(`(${installStorageCheck.toString()})()`), true)
      assert.equal(await evaluate('document.querySelector(".student-review__navigation button:last-child").disabled'), true)
      await evaluate('document.querySelectorAll(".student-answers button")[0].click()')
      await button('정답 확인'); await text('오답입니다.')
      await noOverflow(); await shot('02-multiple-choice-mobile.png')
      // 정답 확인 뒤에도 답을 변경할 수 있으며 재확인 전에는 다음으로 넘어가지 않는다.
      await evaluate('document.querySelectorAll(".student-answers button")[1].click()')
      assert.equal(await evaluate('document.querySelector(".student-review__navigation button:last-child").disabled'), true)
      await button('정답 확인'); await text('정답입니다.')
      await button('다음 문항'); await text('O/X 문제')
      assert.equal(await evaluate('document.querySelectorAll(".student-answers button").length'), 2)
      await evaluate('document.querySelectorAll(".student-answers button")[1].click()')
      await button('정답 확인'); await text('오답입니다.')
      await noOverflow(); await shot('03-ox-mobile.png')
      await button('이전 문항'); await text(sampleDetail.questions[0].content)
      assert.equal(await evaluate('document.querySelectorAll(".student-answers button")[1].getAttribute("aria-pressed")'), 'true')
      await button('다음 문항'); await button('복습 완료'); await text('복습을 마쳤어요')
      assert.deepEqual(await evaluate('[...document.querySelectorAll(".student-review__summary dd")].map(e=>e.textContent)'), ['2문항', '1개', '1개', '50%'])
      await noOverflow(); await shot('04-result-mobile.png')
      assert.equal(await evaluate('window.review54StorageUnchanged()'), true, 'Browser storage changed during review')
      assert.ok(requests.slice(reviewStart).every(r => r.method === 'GET'))
      await button('문항 다시 보기'); await text(sampleDetail.questions[0].content)
      await loadDocument('Page.reload'); await text(sampleDetail.questions[0].content)
      assert.equal(await evaluate('document.querySelectorAll(".student-answers [aria-pressed=true]").length'), 0)
      await shot('05-reload-reset-mobile.png')
      await evaluate('document.querySelectorAll(".student-answers button")[1].click()')
      await button('정답 확인')
      await evaluate('document.querySelector(".student-review__heading a").click()'); await text('다시 풀어보기')
      await goto(`/student/review/${sample.id}`); await text(sampleDetail.questions[0].content)
      assert.equal(await evaluate('document.querySelectorAll(".student-answers [aria-pressed=true]").length'), 0)
      stage = 'errors-and-retry'
      await goto(`/student/review/${privateSet.id}`); await text('비공개이거나 접근할 수 없는')
      await shot('06-private-403-mobile.png')
      await goto('/student/review/99999999'); await text('문제 세트를 찾을 수 없습니다.')
      await shot('07-not-found-mobile.png')
      const invalidStart = requests.length
      await goto('/student/review/invalid'); await text('올바른 문제 세트 주소가 아닙니다.')
      assert.ok(!requests.slice(invalidStart).some(r => r.path.includes('/question-sets/invalid')))
      await goto(`/student/review/${emptySet.id}`); await text('등록된 문제가 없는 세트입니다.')
      await shot('08-empty-set-mobile.png')
      await cdp('Network.setBlockedURLs', { urls: ['*question-sets/public*'] })
      await goto('/student'); await text('서버에 연결할 수 없습니다.')
      await cdp('Network.setBlockedURLs', { urls: [] })
      await button('다시 시도'); await until('document.querySelectorAll(".student-review-list__item").length === 20')
      await goto('/join/123456'); await text('수업 입장')
      assert.equal(await evaluate('document.querySelector(".student-review-list") === null'), true)
      stage = 'publish-owned-fixture'
      await api(`/question-sets/${privateSet.id}`, token, 'PATCH', { visibility: 'PUBLIC' })
      try {
        await goto('/student'); await text(privateSet.title)
        assert.ok((await api('/question-sets/public', student.accessToken)).content.some(set => set.id === privateSet.id))
      } finally { await api(`/question-sets/${privateSet.id}`, token, 'PATCH', { visibility: 'PRIVATE' }) }
      stage = 'mock-empty-list'
      await cdp('Fetch.enable', { patterns: [{ urlPattern: '*api/question-sets/public*', requestStage: 'Request' }] })
      const mockEmpty = async params => {
        await cdp('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })).toString('base64'),
        })
      }
      fetchHandler = mockEmpty
      try {
        await goto('/student'); await text('공개된 문제 세트가 없습니다.')
        assert.equal(await evaluate('document.querySelectorAll(".student-review-list__item").length'), 0)
        await noOverflow(); await shot('10-empty-list-mobile.png')
      } finally { await cdp('Fetch.disable'); fetchHandler = undefined }
      stage = 'mock-page-shrink'
      const shrinkPages = []
      let shrunk = false
      fetchHandler = async params => {
        const page = Number(new URL(params.request.url).searchParams.get('page') ?? 0)
        shrinkPages.push(page)
        if (page === 1) shrunk = true
        const row = { id: sample.id, title: sample.title, ownerName: sampleDetail.ownerName,
          questionCount: 2, updatedAt: '2026-11-10T00:00:00Z' }
        await cdp('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify({ content: page === 1 ? [] : [row], page, size: 20,
            totalElements: shrunk ? 1 : 21, totalPages: shrunk ? 1 : 2 })).toString('base64'),
        })
      }
      await cdp('Fetch.enable', { patterns: [{ urlPattern: '*api/question-sets/public*', requestStage: 'Request' }] })
      try {
        await goto('/student')
        await until('document.querySelector(".student-review-list__pages span")?.textContent === "1 / 2"')
        await button('다음')
        await until('document.querySelector(".student-review-list__pages span")?.textContent === "1 / 1" && document.querySelectorAll(".student-review-list__item").length === 1')
        assert.ok(shrinkPages.includes(1) && shrinkPages.at(-1) === 0)
        const count = shrinkPages.length
        await pause(300)
        assert.equal(shrinkPages.length, count, 'Page correction must stop fetching')
        await noOverflow(); await shot('11-page-correction-mobile.png')
      } finally { await cdp('Fetch.disable'); fetchHandler = undefined }
      stage = 'verify-existing-data'
      const afterExisting = (await api('/question-sets/mine', token)).filter(set => beforeExisting.some(before => before.id === set.id))
      assert.ok(isDeepStrictEqual(beforeExisting, afterExisting), 'Existing sets must remain unchanged')
      assert.deepEqual(requests.filter(r => r.method !== 'GET' && r.path !== '/api/auth/login'), [])
      assert.ok(statuses.some(r => r.path === `/api/question-sets/${privateSet.id}` && r.status === 403))
      assert.ok(statuses.some(r => r.path === '/api/question-sets/99999999' && r.status === 404))
      assert.equal(exceptionCount, 0, 'No browser exceptions')
      await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
      await goto(`/student/review/${sample.id}`); await text(sampleDetail.questions[0].content)
      await noOverflow(); await shot('09-review-desktop.png')
      writeFileSync(new URL('results.json', output), JSON.stringify({
        backend: 'existing review54 server; only fixtures created by this run were changed', viewport: [390, 844],
        sampleSetId: sample.id, privateSetId: privateSet.id, emptySetId: emptySet.id,
        checks: ['live public pagination', 'private excluded', 'multiple choice', 'OX', 'change answer',
          'previous/next', 'result 2/1/1/50%', 'storage unchanged (browser boolean)', 'reload reset', 'leave reset',
          '403', '404', 'invalid ID no fetch', 'empty set', 'network failure retry', 'QR hides list',
          'published owned set appears', 'mocked empty list', 'mocked page shrink correction without loop',
          'existing sets unchanged', 'no answer writes',
          '390px no overflow', 'desktop no overflow', 'no runtime exceptions'],
        requests, statuses,
      }, null, 2) + '\n')
      console.log('PASS: live API and browser checks; credentials and tokens omitted')
    } finally {
      try {
        await cdp('Fetch.disable')
        await cdp('Network.setBlockedURLs', { urls: [] })
      } finally { ws.close() }
    }
  } finally {
    ws?.close()
    if (token) await cleanup(token)
  }
}

run().catch(() => {
  console.error(`FAIL: review E2E check ${stage} failed (sensitive details suppressed)`)
  process.exitCode = 1
})
