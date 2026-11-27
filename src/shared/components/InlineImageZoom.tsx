import { useId, useState } from 'react'
import type { CSSProperties, ImgHTMLAttributes } from 'react'
import { Button } from './Button'
import './InlineImageZoom.css'

type Props = Pick<ImgHTMLAttributes<HTMLImageElement>, 'width' | 'height' | 'onError'> & {
  src: string
  alt: string
}

/** Key by the loaded image URL so replacing the image resets its display state. */
export function InlineImageZoom(image: Props) {
  const imageId = useId()
  const [size, setSize] = useState<{ aspectRatio: number; compact: boolean }>()
  const [expanded, setExpanded] = useState(false)
  const compact = size?.compact && !expanded

  return <div className={`inline-image-zoom${expanded ? ' inline-image-zoom--expanded' : ''}`}>
    <div className={`inline-image-zoom__frame${compact ? ' inline-image-zoom__frame--compact' : ''}`}
      style={{ '--image-aspect-ratio': size?.aspectRatio } as CSSProperties}>
      <img {...image} id={imageId} className="inline-image-zoom__image"
        onLoad={({ currentTarget: img }) => setSize({
          aspectRatio: img.naturalWidth / img.naturalHeight,
          compact: Math.min(img.width, img.height) < 56,
        })} />
      {size && <Button variant="outline" size="sm" className="inline-image-zoom__toggle"
        aria-label={expanded ? '이미지 축소' : '이미지 확대'} aria-expanded={expanded} aria-controls={imageId}
        onClick={() => setExpanded(current => !current)}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.2 15.2 4.3 4.3M8 10.5h5" />
          {!expanded && <path d="M10.5 8v5" />}
        </svg>
      </Button>}
    </div>
  </div>
}
