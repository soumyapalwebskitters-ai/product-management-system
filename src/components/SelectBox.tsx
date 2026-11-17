import { Children, isValidElement, useEffect, useId, useRef, useState, type SelectHTMLAttributes, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

// Keep the native control as the form/event bridge; the visible control is custom.
export function SelectBox({ children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  const native = useRef<HTMLSelectElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [localValue, setLocalValue] = useState(String(props.defaultValue ?? ''))
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 260 })
  const options = Children.toArray(children).filter(isValidElement).map((child) => {
    const option = child as ReactElement<{ value?: string | number; children?: string; disabled?: boolean }>
    return { value: String(option.props.value ?? option.props.children ?? ''), label: option.props.children, disabled: option.props.disabled }
  })
  const value = String(props.value ?? (localValue || options[0]?.value) ?? '')
  const selected = options.findIndex((option) => option.value === value)

  function show() {
    if (props.disabled) return
    const rect = trigger.current!.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - 16
    const height = Math.min(260, options.length * 44 + 12)
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width, top: below >= height ? rect.bottom + 6 : Math.max(8, rect.top - height - 6), maxHeight: Math.min(height, window.innerHeight - 24) })
    setActive(selected >= 0 ? selected : 0)
    setOpen(true)
  }
  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled || !native.current) return
    native.current.value = option.value
    setLocalValue(option.value)
    native.current.dispatchEvent(new Event('change', { bubbles: true }))
    setOpen(false)
    trigger.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false)
    }
    function close(event: Event) { if (!popup.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [open])
  useEffect(() => { if (open) popup.current?.children[active]?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  return <span className={`select-box ${className}`}>
    <select {...props} id={undefined} ref={native} hidden tabIndex={-1} aria-hidden="true">{children}</select>
    <button ref={trigger} id={props.id} type="button" className="select-trigger" role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="listbox" aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={props.disabled}
      onBlur={() => setOpen(false)} onClick={() => open ? setOpen(false) : show()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); return }
        if (event.key === 'Tab') { setOpen(false); return }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (open) choose(active); else show(); return }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          if (!open) { show(); return }
          const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0)
          const current = enabled.indexOf(active)
          setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length] ?? 0)
        } else if (event.key.length === 1) {
          const match = options.findIndex((option) => !option.disabled && String(option.label).toLowerCase().startsWith(event.key.toLowerCase()))
          if (match >= 0) { event.preventDefault(); if (!open) show(); setActive(match) }
        }
      }}><span>{options[selected]?.label ?? 'Select an option'}</span><Icon name="caret" /></button>
    {open && createPortal(<div ref={popup} id={id} className="select-options" role="listbox" aria-label={props['aria-label'] ?? 'Options'} style={position} onMouseDown={(event) => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value} aria-disabled={option.disabled || undefined} className={active === index ? 'is-active' : ''} onPointerMove={() => !option.disabled && setActive(index)} onClick={() => choose(index)}><span>{option.label}</span>{value === option.value && <span aria-hidden="true">✓</span>}</div>)}
    </div>, document.body)}
  </span>
}
