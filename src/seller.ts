import type { Outcome } from './inventory'
import type { SellerProfile, State } from './types'

const MAX_IMAGE = 1_200_000

function trimmed(value: string, label: string, max: number) {
  const next = value.trim()
  if (next.length > max) return { ok: false as const, error: `${label} must be ${max} characters or fewer.` }
  return { ok: true as const, value: next }
}

function image(value: string | undefined, label: string) {
  const next = value ?? ''
  if (next === '') return { ok: true as const, value: '' }
  if (!next.startsWith('data:image/') || next.length > MAX_IMAGE) {
    return { ok: false as const, error: `${label} must be a photo.` }
  }
  return { ok: true as const, value: next }
}

export function updateSeller(state: State, input: SellerProfile): Outcome {
  const name = trimmed(input.name, 'Seller name', 80)
  const address = trimmed(input.address, 'Address', 200)
  const gst = trimmed(input.gst, 'GST number', 20)
  const businessName = trimmed(input.businessName, 'Business name', 80)
  const profileImage = image(input.profileImage, 'Profile image')
  const logo = image(input.logo, 'Business logo')
  const facebook = trimmed(input.facebook, 'Facebook', 120)
  const instagram = trimmed(input.instagram, 'Instagram', 120)
  const youtube = trimmed(input.youtube, 'YouTube', 120)
  const whatsapp = trimmed(input.whatsapp, 'WhatsApp ID', 40)
  const checked = [name, address, gst, businessName, profileImage, logo, facebook, instagram, youtube, whatsapp]
  const invalid = checked.find((field) => !field.ok)
  if (invalid && !invalid.ok) return invalid

  const next = structuredClone(state)
  next.seller = {
    name: name.ok ? name.value : '',
    address: address.ok ? address.value : '',
    gst: gst.ok ? gst.value : '',
    businessName: businessName.ok ? businessName.value : '',
    ...(profileImage.ok && profileImage.value ? { profileImage: profileImage.value } : {}),
    ...(logo.ok && logo.value ? { logo: logo.value } : {}),
    facebook: facebook.ok ? facebook.value : '',
    instagram: instagram.ok ? instagram.value : '',
    youtube: youtube.ok ? youtube.value : '',
    whatsapp: whatsapp.ok ? whatsapp.value : '',
  }
  return { ok: true, state: next }
}
