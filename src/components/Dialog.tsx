import { useEffect, useId, useRef, type ReactNode } from 'react'

type DialogProps = {
  title: string
  subtitle?: string
  onClose: () => void
  wide?: boolean
  narrow?: boolean
  closeOnBackdrop?: boolean
  children: ReactNode
}

export function Dialog({
  title,
  subtitle,
  onClose,
  wide = false,
  narrow = false,
  closeOnBackdrop = true,
  children,
}: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (document.querySelector('.picker-trigger[aria-expanded="true"]')) return
      const dialogs = document.querySelectorAll('[role="dialog"]')
      const top = dialogs[dialogs.length - 1]
      if (panelRef.current && top !== panelRef.current) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="backdrop"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className={`dialog${wide ? ' wide' : ''}${narrow ? ' narrow' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
      >
        <header className="dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={title} onClose={onClose} narrow>
      <p className="confirm-body">{body}</p>
      <div className="dialog-actions">
        <button type="button" className="btn secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={danger ? 'btn danger' : 'btn'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
