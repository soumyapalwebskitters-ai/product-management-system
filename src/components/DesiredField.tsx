import { useEffect, useState } from 'react'
import { parseWhole } from '../format'
import { MAX_STOCK } from '../inventory'

export function DesiredField({
  value,
  label,
  onSave,
}: {
  value: number
  label: string
  onSave: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(String(value))
    setError(null)
  }, [value])

  function commit(raw: string) {
    const parsed = parseWhole(raw)
    if (parsed === null) {
      setError('Use a whole number.')
      return
    }
    if (parsed > MAX_STOCK) {
      setError('That level is too large.')
      return
    }
    setError(null)
    setText(String(parsed))
    if (parsed !== value) onSave(parsed)
  }

  return (
    <span className="desired-field">
      <input
        className="desired-input"
        aria-label={label}
        inputMode="numeric"
        data-testid="desired-input"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit(event.currentTarget.value)
            event.currentTarget.blur()
          }
        }}
        onWheel={(event) => event.currentTarget.blur()}
      />
      {error && <span className="field-error">{error}</span>}
    </span>
  )
}
