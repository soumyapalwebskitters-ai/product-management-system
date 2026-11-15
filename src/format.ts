export function itemsLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`
}

export function boxesLabel(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? 'box' : 'boxes'}`
}

export function formatDay(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatWhen(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function signed(delta: number) {
  if (delta > 0) return `+${delta.toLocaleString()}`
  return delta.toLocaleString()
}

export function rupees(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
}

const paymentLabels = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank: 'Bank transfer',
} as const

export function paymentLabel(method: keyof typeof paymentLabels | undefined) {
  return paymentLabels[method ?? 'cash']
}

export function parseWhole(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const number = Number(trimmed)
  if (!Number.isSafeInteger(number)) return null
  return number
}
