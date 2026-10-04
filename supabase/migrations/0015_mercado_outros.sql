-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — quinto mercado: "Outros (especificar)"           ║
-- ║                                                                ║
-- ║  A conta que não se encaixa nos quatro mercados do site ainda   ║
-- ║  precisa entrar na base. O setor real vai em `segment_other`,   ║
-- ║  obrigatório quando o mercado é "outros" — senão a categoria    ║
-- ║  vira um balaio sem informação.                                 ║
-- ╚══════════════════════════════════════════════════════════════╝

alter table accounts add column if not exists segment_other text;

alter table accounts drop constraint if exists accounts_segment_check;
alter table accounts add constraint accounts_segment_check
  check (segment in ('servicos-b2b','industria','varejo-franquias','empresas-digitais','outros'));

-- "Outros" exige a especificação do setor.
alter table accounts drop constraint if exists accounts_segment_other_check;
alter table accounts add constraint accounts_segment_other_check
  check (segment is distinct from 'outros' or segment_other is not null);

-- Microssegmento de "Outros" também pode ser cadastrado na tabela editável.
alter table micro_segments drop constraint if exists micro_segments_segment_check;
alter table micro_segments add constraint micro_segments_segment_check
  check (segment in ('servicos-b2b','industria','varejo-franquias','empresas-digitais','outros'));
