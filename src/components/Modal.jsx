import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-ink-950/40 p-4 sm:p-8">
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-auto`}>
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3.5">
          <h2 className="text-sm font-bold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-200 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
