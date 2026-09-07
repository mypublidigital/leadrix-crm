// Logo oficial da Consulcard (public/logo.png) com o rótulo "CRM" abaixo.

export default function Logo({ width = 150, className = '', crmAlign = 'end' }) {
  return (
    <div className={`inline-flex flex-col ${className}`}>
      <img src="/logo.png" alt="Consulcard" style={{ width }} className="block h-auto" />
      <span
        className={`mt-1 text-xs font-bold uppercase tracking-[0.3em] text-accent-600 ${
          crmAlign === 'center' ? 'self-center' : 'self-end pr-0.5'
        }`}
      >
        CRM
      </span>
    </div>
  )
}
