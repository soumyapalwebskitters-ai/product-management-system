import { useEffect, useId, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Dialog } from './Dialog'

const VIEW = 320
const EXPORT = 720
const MAX_DATA_URL = 1_200_000

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function paint(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  zoom: number,
  rotation: number,
  x: number,
  y: number,
) {
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#1c1915'
  ctx.fillRect(0, 0, size, size)
  ctx.save()
  ctx.translate(size / 2 + x, size / 2 + y)
  ctx.rotate((rotation * Math.PI) / 180)
  const quarterTurn = Math.abs(rotation % 180) === 90
  const boxW = quarterTurn ? img.naturalHeight : img.naturalWidth
  const boxH = quarterTurn ? img.naturalWidth : img.naturalHeight
  const cover = Math.max(size / boxW, size / boxH)
  ctx.drawImage(img, (-img.naturalWidth * cover * zoom) / 2, (-img.naturalHeight * cover * zoom) / 2, img.naturalWidth * cover * zoom, img.naturalHeight * cover * zoom)
  ctx.restore()
}

function panLimit(img: HTMLImageElement, size: number, zoom: number, rotation: number) {
  const quarterTurn = Math.abs(rotation % 180) === 90
  const boxW = quarterTurn ? img.naturalHeight : img.naturalWidth
  const boxH = quarterTurn ? img.naturalWidth : img.naturalHeight
  const cover = Math.max(size / boxW, size / boxH)
  return {
    x: Math.max(0, (boxW * cover * zoom - size) / 2),
    y: Math.max(0, (boxH * cover * zoom - size) / 2),
  }
}

function PhotoEditor({
  url,
  onCancel,
  onUse,
}: {
  url: string
  onCancel: () => void
  onUse: (image: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)
  const zoomId = useId()

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setReady(true)
    }
    img.onerror = () => setError('That image could not be opened.')
    img.src = url
    return () => {
      imageRef.current = null
    }
  }, [url])

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img || !ready) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const limit = panLimit(img, VIEW, zoom, rotation)
    const x = clamp(offset.x, -limit.x, limit.x)
    const y = clamp(offset.y, -limit.y, limit.y)
    paint(ctx, img, VIEW, zoom, rotation, x, y)
  }, [offset, ready, rotation, zoom])

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const img = imageRef.current
    const start = drag.current
    if (!img || !start) return
    const limit = panLimit(img, VIEW, zoom, rotation)
    setOffset({
      x: clamp(start.originX + event.clientX - start.x, -limit.x, limit.x),
      y: clamp(start.originY + event.clientY - start.y, -limit.y, limit.y),
    })
  }

  function usePhoto() {
    const img = imageRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = EXPORT
    canvas.height = EXPORT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scale = EXPORT / VIEW
    const limit = panLimit(img, VIEW, zoom, rotation)
    paint(
      ctx,
      img,
      EXPORT,
      zoom,
      rotation,
      clamp(offset.x, -limit.x, limit.x) * scale,
      clamp(offset.y, -limit.y, limit.y) * scale,
    )
    let dataUrl = canvas.toDataURL('image/jpeg', 0.86)
    if (dataUrl.length > MAX_DATA_URL) dataUrl = canvas.toDataURL('image/jpeg', 0.6)
    if (dataUrl.length > MAX_DATA_URL) {
      setError('That photo is still too large. Zoom in and crop a smaller area.')
      return
    }
    onUse(dataUrl)
  }

  return (
    <Dialog title="Crop photo" subtitle="Drag to frame it, then zoom or rotate." onClose={onCancel} narrow>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="photo-editor">
        <canvas
          ref={canvasRef}
          className="photo-stage"
          width={VIEW}
          height={VIEW}
          aria-label="Crop area"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId)
            drag.current = { x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y }
          }}
          onPointerMove={move}
          onPointerUp={() => {
            drag.current = null
          }}
          onPointerCancel={() => {
            drag.current = null
          }}
        />
        <label className="field" htmlFor={zoomId}>
          <span>Zoom</span>
          <input
            id={zoomId}
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
        </label>
        <div className="photo-tools">
          <button type="button" className="btn secondary small" onClick={() => setRotation((value) => (value + 270) % 360)}>
            Rotate left
          </button>
          <button type="button" className="btn secondary small" onClick={() => setRotation((value) => (value + 90) % 360)}>
            Rotate right
          </button>
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={usePhoto} disabled={!ready}>
          Use photo
        </button>
      </div>
    </Dialog>
  )
}

export function ProductImageField({
  image,
  onChange,
  label = 'Product photo',
  testId = 'product-photo',
}: {
  image: string
  onChange: (image: string) => void
  label?: string
  testId?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const draftRef = useRef<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (draftRef.current) URL.revokeObjectURL(draftRef.current)
    }
  }, [])

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      return
    }
    if (file.size > 8_000_000) {
      setError('Choose an image under 8 MB.')
      return
    }
    setError(null)
    if (draftRef.current) URL.revokeObjectURL(draftRef.current)
    const url = URL.createObjectURL(file)
    draftRef.current = url
    setDraft(url)
  }

  return (
    <div className="photo-field">
      <span className="photo-label">{label}</span>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="photo-row">
        {image ? (
          <img className="photo-thumb" src={image} alt="" />
        ) : (
          <div className="photo-thumb empty" aria-hidden="true">
            No photo
          </div>
        )}
        <div className="photo-actions">
          <button type="button" className="btn secondary small" data-testid={testId} onClick={() => inputRef.current?.click()}>
            {image ? 'Change photo' : 'Upload photo'}
          </button>
          {image && (
            <button type="button" className="btn danger-text small" onClick={() => onChange('')}>
              Remove photo
            </button>
          )}
          <p className="hint">Crop and rotate the photo before it is added.</p>
        </div>
      </div>
      <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={choose} />
      {draft && (
        <PhotoEditor
          url={draft}
          onCancel={() => {
            if (draftRef.current) URL.revokeObjectURL(draftRef.current)
            draftRef.current = null
            setDraft(null)
          }}
          onUse={(next) => {
            if (draftRef.current) URL.revokeObjectURL(draftRef.current)
            draftRef.current = null
            setDraft(null)
            onChange(next)
          }}
        />
      )}
    </div>
  )
}

export function ProductPhoto({ src, name }: { src: string; name: string }) {
  const [open, setOpen] = useState(false)
  if (!src) return null
  return (
    <>
      <button type="button" className="item-photo" aria-label={`View photo of ${name}`} onClick={() => setOpen(true)}>
        <img src={src} alt="" />
      </button>
      {open && (
        <Dialog title={name} onClose={() => setOpen(false)} narrow>
          <img className="photo-full" src={src} alt={name} />
        </Dialog>
      )}
    </>
  )
}
