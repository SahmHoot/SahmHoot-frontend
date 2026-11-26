import { useState } from 'react'
import type { ImageMetadata } from '../api/image'
import { useImagePreview } from '../hooks/useImagePreview'
import { Button } from './Button'

export function QuestionImage({ image }: { image?: ImageMetadata | null }) {
  const { preview, retry } = useImagePreview(image?.url)
  const [failedUrl, setFailedUrl] = useState<string>()
  if (!image || !preview) return null

  return <div className="my-3 min-w-0">
    {preview.status === 'loading' ? <p role="status" className="text-sm">이미지를 불러오는 중입니다.</p>
      : preview.status === 'error' || preview.url === failedUrl ? <>
        <p role="status" className="mb-2 text-sm">문항 이미지를 불러오지 못했습니다.</p>
        <Button variant="outline" onClick={retry}>이미지 다시 시도</Button>
      </> : <img
        src={preview.url}
        alt="문항 이미지"
        width={image.width}
        height={image.height}
        onError={() => setFailedUrl(preview.url)}
        className="mx-auto block h-auto max-h-56 w-auto max-w-full rounded-md object-contain"
      />}
  </div>
}
