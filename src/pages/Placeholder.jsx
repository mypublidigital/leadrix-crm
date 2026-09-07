import { Construction } from 'lucide-react'
import PageHeader from '../components/PageHeader'

export default function Placeholder({ title, subtitle, module }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid place-items-center p-16">
        <div className="card flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-500">
            <Construction size={24} />
          </div>
          <p className="text-sm text-ink-600">
            Esta tela faz parte de um próximo incremento do build.
          </p>
          {module && (
            <span className="chip bg-brand-50 text-brand-600">{module}</span>
          )}
        </div>
      </div>
    </>
  )
}
