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
  runInNewContext(outputText, { exports, structuredClone, crypto,
    ...globals, require: (id) => dependencies[id] })
  return exports
}

const model = load('features/questionset/editorDraft')
const { saveEditor } = load('features/questionset/saveEditor', { './editorDraft': model })
const { imageQuestionCandidates, planRecovery, preserveDraft, recoveryFromRoute } = load('features/questionset/editorRecovery', { './editorDraft': model })
const file = new File(['image'], 'sample.png', { type: 'image/png' })
const metadata = { url: '/api/question-sets/11/questions/9/image', width: 32, height: 16, mimeType: 'image/png' }
const upload = { imageRef: 'image-reference', ...metadata, expiresAt: '2099-01-01T00:00:00Z', sizeBytes: 5 }
const attach = (uploaded) => ({ kind: 'attach', file, upload: uploaded })
const question = (serverId, imageChange) => ({ id: 'draft-1', serverId, imageChange, prompt: '문항', type: 'ox', seconds: 30, options: ['O', 'X'], answer: 0 })
const draft = (...questions) => ({ name: '테스트', description: '', isPublic: false, questions })

function api() {
  const calls = []
  const fake = {
    createQuestionSet: async () => { calls.push('createSet'); return { id: 11 } },
    updateQuestionSet: async () => {},
    uploadQuestionImage: async (id, file) => { calls.push(['upload', id, file]); return upload },
    addQuestion: async (id, body) => { calls.push(['POST', id, body]); return { id: 9, image: metadata } },
    updateQuestion: async (id, questionId, body) => { calls.push(['PUT', id, questionId, body]); return { id: questionId, image: body.imageRef === null ? null : metadata } },
    reorderQuestions: async () => { calls.push('reorder') },
    toQuestionSetApiError: (error) => error,
  }
  return { fake, calls }
}

test('신규 세트 ID 발급 → 이미지 업로드 → 문항 POST 순서와 연결 완료 체크포인트', async () => {
  const { fake, calls } = api()
  const submitted = question(undefined, attach())
  const point = { creating: false, questionIds: [] }
  await saveEditor(draft(submitted), point, fake)
  assert.deepEqual(calls[0], 'createSet')
  assert.deepEqual(calls[1], ['upload', 11, file])
  assert.equal(calls[2][2].imageRef, upload.imageRef)
  assert.equal(point.createdIds[submitted.id], 9)
  assert.equal(submitted.imageChange, undefined)
  assert.equal(submitted.image, metadata)
})

test('기존 이미지는 imageRef 생략으로 유지하고 제거는 null로 전송한다', async () => {
  const { fake, calls } = api()
  const point = { creating: false, setId: 11, questionIds: [9] }
  await saveEditor(draft(question(9)), point, fake)
  assert.equal('imageRef' in calls[0][3], false)
  calls.length = 0
  await saveEditor(draft(question(9, { kind: 'remove' })), point, fake)
  assert.equal(calls[0][3].imageRef, null)
})

test('업로드 실패 시 문항 POST를 보내지 않고 원본 파일을 유지한다', async () => {
  const { fake, calls } = api()
  const point = { creating: false, setId: 11, questionIds: [] }
  const submitted = question(undefined, attach())
  fake.uploadQuestionImage = async () => { throw Error('offline') }
  await assert.rejects(saveEditor(draft(submitted), point, fake), /offline/)
  assert.deepEqual(calls, [])
  assert.equal(point.pendingQuestionId, undefined)
  assert.equal(point.uploadingQuestionId, submitted.id)
  assert.equal(submitted.imageChange.file, file)
})

test('부분 실패 후 유효한 참조를 재사용하며 거절되거나 만료된 참조만 갱신한다', async () => {
  const { fake, calls } = api()
  const point = { creating: false, setId: 11, questionIds: [9] }
  const submitted = question(9, attach())
  const originalUpdate = fake.updateQuestion
  fake.updateQuestion = async () => { throw Error('disconnected') }
  await assert.rejects(saveEditor(draft(submitted), point, fake), /disconnected/)
  assert.equal(submitted.imageChange.upload.imageRef, upload.imageRef)
  fake.updateQuestion = originalUpdate
  await saveEditor(draft(submitted), point, fake)
  assert.equal(calls.filter(([kind]) => kind === 'upload').length, 1)

  let failed = false
  fake.updateQuestion = async (...args) => {
    if (!failed) {
      failed = true
      throw { code: 'QUESTION_IMAGE_NOT_AVAILABLE' }
    }
    return originalUpdate(...args)
  }
  await saveEditor(draft(question(9, attach(upload))), point, fake)
  await saveEditor(draft(question(9, attach({ ...upload, expiresAt: '2020-01-01T00:00:00Z' }))), point, fake)
  assert.equal(calls.filter(([kind]) => kind === 'upload').length, 3)
})

test('문항 POST 응답 유실은 재전송을 차단하고 재조회에서 일치하는 새 문항만 복구 후보로 노출한다', async () => {
  const { fake } = api()
  const point = { creating: false, setId: 11, questionIds: [] }
  const submitted = draft(question(undefined, attach(upload)))
  fake.addQuestion = async () => { throw Error('response lost') }
  await assert.rejects(saveEditor(submitted, point, fake), /response lost/)
  await assert.rejects(saveEditor(submitted, point, fake), /먼저 확인/)
  const recovery = preserveDraft(submitted, [], point)
  const server = draft({ ...question(9), image: metadata }, { ...question(12), image: null })
  assert.equal(planRecovery(recovery, server).restored, null)
  assert.deepEqual(Array.from(imageQuestionCandidates(recovery, server), (item) => item.id), [9])
  const restored = planRecovery({ ...recovery, uncertainQuestionId: undefined, createdIds: { 'draft-1': 9 } }, server)
  assert.equal(restored.restored.questions[0].serverId, 9)
  assert.equal(restored.restored.questions[0].imageChange.upload.imageRef, upload.imageRef)
  assert.equal(restored.restored.questions[1].serverId, 12)
})

test('image draft in browser history is restored only for the originating account', () => {
  const saved = preserveDraft(draft(question(9, attach())), [9], { creating: false, setId: 11, questionIds: [9] })
  const state = { questionSetRecovery: saved, recoveryUserId: 3 }
  assert.equal(recoveryFromRoute(state, 11, 3).draft.questions[0].imageChange.file.name, file.name)
  assert.equal(recoveryFromRoute(state, 11, 4), null)
  assert.equal(recoveryFromRoute({ questionSetRecovery: saved }, 11, 3), null)
  assert.equal(recoveryFromRoute(state, 12, 3), null)
})
