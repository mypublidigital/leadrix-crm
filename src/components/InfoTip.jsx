import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

// Alinhamento da etiqueta. Em coluna estreita (filtro, KPI) a etiqueta
// centralizada vaza da tela: nas pontas use `start` ou `end`.
const ALIGN = {
  center: 'left-1/2 -translate-x-1/2',
  start: 'left-0',
  end: 'right-0',
}

// Ícone de interrogação com etiqueta de instrução em mouse-over (e em foco por
// teclado, para quem navega com Tab).
export default function InfoTip({ children, size = 14, align = 'center', width = 'w-72', className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label="Instruções do campo"
    >
      <HelpCircle size={size} className="cursor-help text-ink-400 hover:text-brand-500" />
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute top-full z-40 mt-1.5 ${width} ${ALIGN[align] || ALIGN.center} rounded-lg bg-ink-900 px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg`}
        >
          {children}
        </span>
      )}
    </span>
  )
}

// Rótulo de campo com a etiqueta de instrução ao lado. Mantém o visual de
// `.label` (caixa alta, espaçado) e devolve o texto da etiqueta ao normal.
export function LabelTip({ children, tip, align = 'center', width }) {
  return (
    <label className="label flex items-center gap-1">
      {children}
      {tip && <InfoTip align={align} width={width}>{tip}</InfoTip>}
    </label>
  )
}
