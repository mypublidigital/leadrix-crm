import { useRef, useState, useEffect } from 'react'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import { copilotChat } from '../lib/copilot'

const SUGGESTIONS = [
  'Qual a próxima ação de ABM para esta conta?',
  'Escreva um roteiro de ligação para o contato.',
  'Sugira um conteúdo personalizado para o sponsor desta conta.',
  'Como devo abordar a estratégia ABM aqui?',
]

// Renderização leve de markdown (negrito, itálico, quebras e listas).
function renderRich(text) {
  return text.split('\n').map((line, i) => {
    const html = line
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
    return <p key={i} className="min-h-[0.5rem]" dangerouslySetInnerHTML={{ __html: html }} />
  })
}

export default function CopilotChat({ account }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const reply = await copilotChat(account, next)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `Erro ao consultar o co-piloto: ${e.message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card flex h-[460px] flex-col border-brand-200 bg-brand-50/30">
      <div className="flex items-center gap-2 border-b border-brand-200 px-4 py-3">
        <Sparkles size={16} className="text-brand-600" />
        <h2 className="text-sm font-bold text-brand-700">Co-piloto ABM</h2>
        <span className="ml-auto text-xs text-ink-400">agente conversacional</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600">
              Pergunte qualquer coisa sobre como conduzir o ABM desta conta. O agente considera o
              contexto da Leadrix, o mercado e o microssegmento da conta, o comitê de compra e as oportunidades por pilar.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-lg border border-brand-200 bg-white px-3 py-2 text-left text-xs text-ink-700 hover:border-brand-400 hover:bg-brand-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === 'user' ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 shadow-sm'
            }`}>
              {m.role === 'assistant' ? <div className="space-y-1">{renderRich(m.content)}</div> : m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Loader2 size={14} className="animate-spin" /> pensando…
          </div>
        )}
      </div>

      <div className="border-t border-brand-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="input max-h-24 min-h-[40px] resize-none"
            placeholder="Escreva uma pergunta…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
          />
          <button className="btn-primary shrink-0" onClick={() => send()} disabled={busy || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
