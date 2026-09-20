export default function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-200 bg-white px-6 py-5">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-normal tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
