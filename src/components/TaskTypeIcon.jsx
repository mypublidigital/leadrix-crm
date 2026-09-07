// Ícone por tipo de tarefa, com import explícito (mantém o tree-shaking do lucide;
// evitar `import * as Icons`, que empacota o set inteiro).
import {
  Layout, Mic, Users, Phone, Video, Utensils, CalendarDays, Plane, FileText, Tag,
} from 'lucide-react'

const MAP = {
  landing_page: Layout,
  podcast: Mic,
  encontro: Users,
  ligacao: Phone,
  reuniao: Video,
  almoco: Utensils,
  evento: CalendarDays,
  viagem: Plane,
  conteudo: FileText,
  outro: Tag,
}

export default function TaskTypeIcon({ type, size = 16 }) {
  const Cmp = MAP[type] || Tag
  return <Cmp size={size} />
}
