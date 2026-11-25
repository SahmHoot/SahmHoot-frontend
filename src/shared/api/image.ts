import { apiClient } from './client'

export interface ImageMetadata {
  url: string
  mimeType: string
  width: number
  height: number
}

export async function getImageBlob(url: string, signal: AbortSignal): Promise<Blob> {
  const imagePath = /^\/api\/(?:question-sets\/\d+|rooms\/\d+\/quiz-runs\/\d+)\/questions\/\d+\/image$/
  if (!imagePath.test(url)) throw new Error('올바른 이미지 주소가 아닙니다.')
  const { data, headers } = await apiClient.get<ArrayBuffer>(url.slice('/api'.length), {
    signal,
    responseType: 'arraybuffer',
    // JSON 인증 오류를 기존 Axios 인터셉터가 인식하도록 복원한다.
    transformResponse: [(body: ArrayBuffer, headers, status) => {
      if (status && status >= 400 && String(headers['content-type']).includes('json')) {
        try { return JSON.parse(new TextDecoder().decode(body)) }
        catch { return body }
      }
      return body
    }],
  })
  const mimeType = headers['content-type']
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') throw new Error('이미지 응답을 읽을 수 없습니다.')
  return new Blob([data], { type: mimeType })
}
