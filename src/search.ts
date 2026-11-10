export type SearchMode = 'smart' | 'keyword'

/** Smart search keeps characters in order. Keyword search requires every word. */
export function matchesQuery(text: string, query: string, mode: SearchMode) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = text.toLowerCase()
  if (mode === 'keyword') {
    return needle.split(/\s+/).every((word) => haystack.includes(word))
  }
  let from = 0
  for (const character of needle.replace(/\s+/g, '')) {
    const found = haystack.indexOf(character, from)
    if (found < 0) return false
    from = found + 1
  }
  return true
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
