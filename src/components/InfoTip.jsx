import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

// Ícone de interrogação com tooltip em mouse-over (e foco por teclado).
export default function InfoTip({ children, size = 14, className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <HelpCircle size={size} className="cursor-help text-ink-400 hover:text-brand-500" />
      {open && (
        <span className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg">
          {children}
        </span>
      )}
    </span>
  )
}
