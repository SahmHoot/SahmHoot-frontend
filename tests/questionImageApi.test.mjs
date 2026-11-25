import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(path, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(`../src/${path}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const exports = {}
  runInNewContext(outputText, { exports, FormData, Blob, TextDecoder,
    ...globals, require: (id) => dependencies[id] })
  return exports
}

const file = new File(['image'], 'sample.png', { type: 'image/png' })
const upload = { imageRef: 'image-reference' }
const metadata = { url: '/api/question-sets/11/questions/9/image' }

test('multipart에는 file 하나를 담고 413 HTML 오류를 용량 초과로 안내한다', async () => {
  const { uploadQuestionImage, toQuestionSetApiError, imageErrorMessage } = load('features/questionset/api', {
    axios: { isAxiosError: (error) => Boolean(error.response) },
    '../../shared/api/client': { apiClient: { post: async (path, body, config) => {
      assert.equal(path, '/question-sets/11/images')
      assert.deepEqual([...body.keys()], ['file'])
      assert.equal(body.get('file').name, file.name)
      assert.equal(config.headers['Content-Type'], undefined)
      return { data: upload }
    } } },
  })
  assert.equal(await uploadQuestionImage(11, file), upload)
  for (const data of ['<html>Too large</html>', '']) {
    const response = toQuestionSetApiError({ response: { status: 413, data } })
    assert.match(imageErrorMessage(response, ''), /5 MiB/)
  }
})

test('인증 이미지 조회는 /api 접두사를 한 번만 적용하고 JSON 401을 인터셉터로 전달한다', async () => {
  const signal = new AbortController().signal
  const { getImageBlob } = load('shared/api/image', { './client': { apiClient: {
    get: async (path, config) => {
      assert.equal(path, '/question-sets/11/questions/9/image')
      assert.equal(config.signal, signal)
      const unauthorized = config.transformResponse[0](new TextEncoder().encode('{"code":"UNAUTHORIZED"}'), { 'content-type': 'application/json' }, 401)
      assert.equal(unauthorized.code, 'UNAUTHORIZED')
      return { data: new ArrayBuffer(12), headers: { 'content-type': 'image/png' } }
    },
  } } })
  const blob = await getImageBlob(metadata.url, signal)
  assert.equal(blob.type, 'image/png')
  assert.equal(blob.size, 12)
  await assert.rejects(getImageBlob('https://external.example/api/file', signal), /주소/)
  await assert.rejects(getImageBlob('/api//external.example/questions/9/image', signal), /주소/)
  await assert.rejects(getImageBlob('/api/api/question-sets/11/questions/9/image', signal), /주소/)
})

test('실행 문항 이미지는 같은 주소를 다시 열 때도 API에 새로 요청한다', async () => {
  let count = 0
  const { getImageBlob } = load('shared/api/image', { './client': { apiClient: {
    get: async (path) => {
      assert.equal(path, '/rooms/2/quiz-runs/7/questions/101/image')
      return { data: Uint8Array.of(++count), headers: { 'content-type': 'image/jpeg' } }
    },
  } } })
  const url = '/api/rooms/2/quiz-runs/7/questions/101/image'
  const signal = new AbortController().signal
  for (const version of [1, 2]) {
    const blob = await getImageBlob(url, signal)
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [version])
  }
})

test('파일 검사에는 5 MiB 및 양변·총 픽셀 제한을 적용한다', async () => {
  let width = 4096
  let height = 3906
  let closed = 0
  const { validateImageFile } = load('features/questionset/questionImage', {}, {
    createImageBitmap: async () => ({ width, height, close: () => closed++ }),
  })
  const maximum = new File([Buffer.alloc(5 * 1024 * 1024)], 'limit.png', { type: 'image/png' })
  await validateImageFile(maximum)
  await assert.rejects(validateImageFile(new File([maximum, 'b'], 'large.png', { type: 'image/png' })), /5 MiB/)
  height++
  await assert.rejects(validateImageFile(file), /1,600만 픽셀/)
  width = 4097
  height = 1
  await assert.rejects(validateImageFile(file), /4096px/)
  assert.equal(closed, 3)
})
