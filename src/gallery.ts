import type { GalleryImage, State } from './types'
import type { Outcome } from './inventory'

function fail(error: string): Outcome { return { ok: false, error } }

export function normalizeDriveImageUrl(value: string) {
  const url = value.trim()
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i)
  if (fileMatch) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileMatch[1])}`
  const queryMatch = url.match(/[?&]id=([^&]+)/i)
  if (queryMatch && /drive\.google\.com/i.test(url)) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(queryMatch[1])}`
  return url
}

export function galleryImageSrc(value: string) {
  if (!value) return value
  try {
    const host = new URL(value).hostname.toLowerCase()
    if (host === 'drive.google.com' || host === 'drive.usercontent.google.com') {
      return `/api/gallery-image?url=${encodeURIComponent(value)}`
    }
  } catch {
    return value
  }
  return value
}

export function addGalleryImage(state: State, input: Omit<GalleryImage, 'id' | 'createdAt'>, now: string): Outcome {
  if (!/^https?:\/\//i.test(input.url.trim())) return fail('Enter a valid Google Drive image URL.')
  const imageUrl = normalizeDriveImageUrl(input.url)
  const product = state.products.find((item) => item.id === input.productId)
  const variant = product?.variants.find((item) => item.id === input.variantId)
  if (!product || !variant) return fail('Choose a valid product variant.')
  if ((state.gallery ?? []).some((item) => item.url.trim() === imageUrl && item.variantId === input.variantId)) return fail('Duplicate data found.')
  const next = structuredClone(state)
  const image: GalleryImage = { id: crypto.randomUUID(), productId: product.id, variantId: variant.id, url: imageUrl, createdAt: now }
  const nextProduct = next.products.find((item) => item.id === product.id)
  const nextVariant = nextProduct?.variants.find((item) => item.id === variant.id)
  if (nextVariant) nextVariant.image = image.url
  next.gallery = [image, ...(next.gallery ?? [])]
  return { ok: true, state: next }
}

export function removeGalleryImage(state: State, id: string): Outcome {
  if (!(state.gallery ?? []).some((item) => item.id === id)) return fail('Gallery image not found.')
  const next = structuredClone(state)
  next.gallery = (next.gallery ?? []).filter((item) => item.id !== id)
  const removed = state.gallery?.find((item) => item.id === id)
  if (removed) {
    const product = next.products.find((item) => item.id === removed.productId)
    const variant = product?.variants.find((item) => item.id === removed.variantId)
    if (variant?.image === removed.url) variant.image = next.gallery.find((item) => item.variantId === removed.variantId)?.url
  }
  return { ok: true, state: next }
}
