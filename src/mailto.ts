export function openMailto(email: string | undefined, subject: string, body: string) {
  const to = email?.trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  return true
<<<<<<< HEAD
}
=======
}
>>>>>>> 1e93a50f783b841383173e99bc31d39d2d1aeb4b
