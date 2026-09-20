// Marca Leadrix: hexágono oficial + wordmark em caixa-alta com tracking largo
// (skill leadrix-design). `tone="dark"` é para fundo preto (menu lateral);
// `tone="light"`, para fundo claro (tela de login).

export default function Logo({ tone = 'dark', height = 30, className = '', showProduct = true }) {
  const mark = tone === 'dark' ? '/mark-white.png' : '/mark-positive.png'
  const word = tone === 'dark' ? 'text-white' : 'text-ink-900'
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <img src={mark} alt="" style={{ height }} className="block w-auto" />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-light uppercase ${word}`} style={{ fontSize: height * 0.62, letterSpacing: '0.28em' }}>
          Leadrix
        </span>
        {showProduct && (
          <span className="mt-1 font-display text-[10px] font-medium uppercase tracking-[0.3em] text-accent-500">
            CRM · ABM
          </span>
        )}
      </span>
    </span>
  )
}
