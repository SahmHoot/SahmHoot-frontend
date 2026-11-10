/** CDP로 실행한다. 인증 정보가 담긴 스냅샷은 브라우저의 클로저에만 둔다. */
export function installStorageCheck() {
  const snapshot = () => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })
  const before = snapshot()
  window.review54StorageUnchanged = () => snapshot() === before
  return true
}

/** 현재 실행의 POST 응답으로 얻은 세트 ID만 변경할 수 있다. */
export function createFixtureClient(request) {
  const created = new Set()
  const api = async (path, token, method = 'GET', body) => {
    const creating = method === 'POST' && path === '/question-sets'
    const login = method === 'POST' && path === '/auth/login'
    const setId = /^\/question-sets\/(\d+)(?:\/questions(?:\/\d+)?)?$/.exec(path)?.[1]
    if (method !== 'GET' && !creating && !login && !created.has(Number(setId))) {
      throw new Error('Refusing to change data not created by this test run')
    }
    const data = await request(path, token, method, body)
    if (creating) created.add(data.id)
    if (method === 'DELETE' && /^\/question-sets\/\d+$/.test(path)) created.delete(Number(setId))
    return data
  }
  const cleanup = async token => {
    let failed = false
    for (const id of [...created].reverse()) {
      try { await api(`/question-sets/${id}`, token, 'DELETE') } catch { failed = true }
    }
    if (failed) throw new Error('Some test fixtures could not be removed; existing data was not changed')
  }
  return { api, cleanup }
}
