import { useEffect, useMemo, useState } from 'react'
import { getImageBlob } from '../api/image'

type Preview = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; error: unknown }

export function useImagePreview(source: File | string | undefined) {
  const [attempt, setAttempt] = useState(0)
  const request = useMemo(() => ({ source, attempt }), [source, attempt])
  const [result, setResult] = useState<{ request: typeof request; preview: Preview }>()
  useEffect(() => {
    const { source } = request
    if (!source) return
    const controller = new AbortController()
    let url: string | undefined
    const load = typeof source === 'string' ? getImageBlob(source, controller.signal) : Promise.resolve(source)
    load.then((blob) => {
      if (controller.signal.aborted) return
      url = URL.createObjectURL(blob)
      setResult({ request, preview: { status: 'ready', url } })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ request, preview: { status: 'error', error } })
    })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [request])
  const preview = source && (result?.request === request
    ? result.preview : { status: 'loading' as const })
  return { preview, retry: () => setAttempt((current) => current + 1) }
}
