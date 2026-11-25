import type { ImageMetadata } from '../../shared/api/image'

export interface ImageUpload extends Omit<ImageMetadata, 'url'> {
  imageRef: string
  sizeBytes: number
  expiresAt: string
}

export type ImageChange = { kind: 'remove' } | { kind: 'attach'; file: File; upload?: ImageUpload }

export async function validateImageFile(file: File): Promise<void> {
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') throw new Error('JPEG 또는 PNG 파일을 선택해 주세요.')
  if (file.size > 5 * 1024 * 1024) throw new Error('이미지 용량은 5 MiB 이하여야 합니다.')
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error('이미지 파일을 읽을 수 없습니다.') })
  const { width, height } = bitmap
  bitmap.close()
  if (width > 4096 || height > 4096 || width * height > 16_000_000) {
    throw new Error('이미지는 양변 4096px, 총 1,600만 픽셀 이하여야 합니다.')
  }
}
