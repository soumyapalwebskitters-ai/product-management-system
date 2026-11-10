import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { escapeRegExp, matchesQuery, type SearchMode } from '../search'

export type SelectOption = {
  id: string
  title: string
  meta?: string
  searchText: string
}

type ProductSelectProps = {
  label: string
  placeholder: string
  options: SelectOption[]
  query: string
  mode: SearchMode
  selectedId: string | null
  onQueryChange: (query: string) => void
  onModeChange: (mode: SearchMode) => void
  onSelect: (id: string | null) => void
  inline?: boolean
}

export function ProductSelect({
  label,
  placeholder,
  options,
  query,
  mode,
  selectedId,
  onQueryChange,
  onModeChange,
  onSelect,
  inline = false,
}: ProductSelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.id === selectedId) ?? null

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return options
      .filter((option) => matchesQuery(option.searchText, query, mode))
      .sort((left, right) => {
        const score = rank(left.searchText, needle, mode) - rank(right.searchText, needle, mode)
        return score || left.title.localeCompare(right.title)
      })
  }, [mode, options, query])

  useEffect(() => {
    setActive(0)
  }, [mode, query, open])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function choose(id: string) {
    onSelect(id)
    onQueryChange('')
    setOpen(false)
  }

  function clear() {
    onSelect(null)
    onQueryChange('')
    setOpen(true)
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
      return
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      clear()
      return
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      onSelect(null)
      onQueryChange(event.key)
      setOpen(true)
    }
  }

  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, Math.max(matches.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = matches[active]
      if (option) choose(option.id)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const triggerText = selected?.title || (query ? `“${query}”` : placeholder)
  const hasValue = Boolean(selected || query)

  return (
    <div className={inline ? 'picker inline' : 'picker'} ref={rootRef} data-testid="product-select">
      <div className="picker-control">
        <button
          type="button"
          className={hasValue ? 'picker-trigger has-value' : 'picker-trigger'}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={onTriggerKeyDown}
        >
          <span className={hasValue ? 'picker-value' : 'picker-placeholder'}>{triggerText}</span>
          <Chevron open={open} />
        </button>
        {hasValue && (
          <button type="button" className="picker-clear" onClick={clear}>
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="picker-panel">
          <label className="picker-search">
            <span className="sr-only">{label}</span>
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              placeholder="Type to search"
              value={query}
              onChange={(event) => {
                onSelect(null)
                onQueryChange(event.target.value)
              }}
              onKeyDown={onSearchKeyDown}
            />
          </label>
          <div className="picker-modes" role="group" aria-label="Search style">
            <button
              type="button"
              className="chip"
              aria-pressed={mode === 'smart'}
              onClick={() => onModeChange('smart')}
            >
              Smart
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={mode === 'keyword'}
              onClick={() => onModeChange('keyword')}
            >
              Keyword
            </button>
          </div>
          <p className="picker-hint">
            {mode === 'smart'
              ? 'A letter matches every name that contains it.'
              : 'Every word must appear in the name or SKU.'}
          </p>
          <p className="picker-count">
            {matches.length} {matches.length === 1 ? 'match' : 'matches'}
          </p>
          <ul className="picker-list" id={listId} role="listbox" aria-label={label}>
            {matches.length === 0 && <li className="picker-empty">No names match.</li>}
            {matches.map((option, index) => (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === selectedId || index === active}
                  className={index === active ? 'picker-option active' : 'picker-option'}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option.id)}
                >
                  <span>
                    {mode === 'keyword' ? (
                      <KeywordText text={option.title} query={query} />
                    ) : (
                      <SmartText text={option.title} query={query} />
                    )}
                  </span>
                  {option.meta && <small>{option.meta}</small>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function rank(text: string, needle: string, mode: SearchMode) {
  if (!needle) return 0
  const haystack = text.toLowerCase()
  if (mode === 'keyword') {
    const words = needle.split(/\s+/)
    return words.some((word) => haystack.startsWith(word)) ? 0 : 1
  }
  const compact = needle.replace(/\s+/g, '')
  if (haystack.startsWith(compact)) return 0
  if (haystack.includes(compact)) return 1
  return 2
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={open ? 'chevron open' : 'chevron'} viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function SmartText({ text, query }: { text: string; query: string }) {
  const compact = query.toLowerCase().replace(/\s+/g, '')
  if (!compact) return <>{text}</>
  const lower = text.toLowerCase()
  const pieces: Array<string | { mark: string; key: number }> = []
  let from = 0
  let searchFrom = 0
  for (const character of compact) {
    const found = lower.indexOf(character, searchFrom)
    if (found < 0) return <>{text}</>
    if (found > from) pieces.push(text.slice(from, found))
    pieces.push({ mark: text[found] ?? character, key: found })
    from = found + 1
    searchFrom = found + 1
  }
  if (from < text.length) pieces.push(text.slice(from))
  return (
    <>
      {pieces.map((piece, index) =>
        typeof piece === 'string' ? (
          <span key={`t-${index}`}>{piece}</span>
        ) : (
          <mark key={`m-${piece.key}`} className="picker-mark">
            {piece.mark}
          </mark>
        ),
      )}
    </>
  )
}

function KeywordText({ text, query }: { text: string; query: string }) {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return <>{text}</>
  const pattern = new RegExp(`(${words.map((word) => escapeRegExp(word)).join('|')})`, 'ig')
  const parts = text.split(pattern)
  return (
    <>
      {parts.map((part, index) =>
        words.some((word) => part.toLowerCase() === word) ? (
          <mark key={index} className="picker-mark">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}
