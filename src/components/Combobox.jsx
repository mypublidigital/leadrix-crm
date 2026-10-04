import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'

// Campo de escolha com busca: digitar filtra a lista, e dá para selecionar com
// teclado. Usado onde a lista é longa demais para um <select> (microssegmentos,
// serviços do catálogo).
//
// `options`: [{ value, label, group?, hint? }]
// `allowFree`: aceita um valor que não está na lista (texto digitado).

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function Combobox({
  value,
  onChange,
  options = [],
  placeholder = 'Digite para buscar…',
  allowFree = false,
  disabled = false,
  emptyLabel = 'Nenhuma opção encontrada',
  id,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const wrapRef = useRef(null)
  const listRef = useRef(null)

  const selected = options.find((o) => o.value === value) || null
  // Fora de edição mostra o rótulo do selecionado; em edição, o que foi digitado.
  const display = open ? query : selected?.label || (allowFree ? value || '' : '')

  const filtered = useMemo(() => {
    const q = norm(open ? query : '')
    if (!q) return options
    return options.filter((o) => norm(o.label).includes(q) || norm(o.group).includes(q))
  }, [options, query, open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    // Mantém o item destacado visível ao navegar com as setas.
    const node = listRef.current?.querySelector('[data-cursor="true"]')
    node?.scrollIntoView({ block: 'nearest' })
  }, [cursor, open])

  function close() {
    setOpen(false)
    setQuery('')
  }

  function choose(option) {
    onChange(option.value, option)
    close()
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setCursor((c) => {
        const next = e.key === 'ArrowDown' ? c + 1 : c - 1
        return Math.max(0, Math.min(filtered.length - 1, next))
      })
      return
    }
    if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      if (filtered[cursor]) choose(filtered[cursor])
      else if (allowFree && query.trim()) { onChange(query.trim()); close() }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  let lastGroup = null

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <input
          id={id}
          className="input pr-14"
          value={display}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => { setOpen(true); setCursor(0) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setCursor(0) }}
          onKeyDown={onKeyDown}
          onBlur={() => { if (allowFree && open && query.trim()) onChange(query.trim()) }}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          {value && !disabled && (
            <button type="button" className="rounded p-1 text-ink-400 hover:text-rose-500"
              onClick={() => { onChange(''); close() }} aria-label="Limpar">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className="pointer-events-none text-ink-400" />
        </div>
      </div>

      {open && !disabled && (
        <ul ref={listRef}
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
          {filtered.map((o, i) => {
            const header = o.group && o.group !== lastGroup ? o.group : null
            lastGroup = o.group
            return (
              <li key={`${o.value}-${i}`}>
                {header && <div className="eyebrow px-3 pb-0.5 pt-2">{header}</div>}
                <button
                  type="button"
                  data-cursor={i === cursor}
                  className={`flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-sm ${
                    i === cursor ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50'
                  } ${o.value === value ? 'font-semibold' : ''}`}
                  onMouseEnter={() => setCursor(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  <span>{o.label}</span>
                  {o.hint && <span className="shrink-0 text-xs text-ink-400">{o.hint}</span>}
                </button>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-400">
              {allowFree && query.trim() ? `Usar “${query.trim()}”` : emptyLabel}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
