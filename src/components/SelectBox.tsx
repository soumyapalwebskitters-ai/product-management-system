import type { SelectHTMLAttributes } from 'react'
import { Icon } from './Icon'

export function SelectBox({ children, className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`select-box ${className}`}>
      <select {...props}>{children}</select>
      <Icon name="caret" />
    </span>
  )
}
