// Ícone por tipo de tarefa, com import explícito (mantém o tree-shaking do lucide;
// evitar `import * as Icons`, que empacota o set inteiro).
import {
  Layout, Users, Phone, Video, Utensils, CalendarDays, Plane, FileText, Tag,
  Mail, Linkedin, Stethoscope, Presentation, Wine, FilePenLine, Gift,
} from 'lucide-react'

const MAP = {
  landing_page: Layout,
  encontro: Users,
  ligacao: Phone,
  email: Mail,
  linkedin: Linkedin,
  reuniao: Video,
  diagnostico: Stethoscope,
  workshop: Presentation,
  almoco: Utensils,
  jantar: Wine,
  evento: CalendarDays,
  viagem: Plane,
  conteudo: FileText,
  proposta: FilePenLine,
  brinde: Gift,
  outro: Tag,
}

export default function TaskTypeIcon({ type, size = 16 }) {
  const Cmp = MAP[type] || Tag
  return <Cmp size={size} />
}
