-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Leadrix CRM — "nome fantasia" vira "razão social"             ║
-- ║                                                                ║
-- ║  O campo chave da conta é o NOME pelo qual o time se refere a   ║
-- ║  ela (é por ele que a importação casa as linhas). O segundo     ║
-- ║  campo, opcional, passa a guardar a razão social — o nome que   ║
-- ║  vai no contrato. A coluna acompanha o significado.             ║
-- ╚══════════════════════════════════════════════════════════════╝

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'accounts' and column_name = 'trade_name')
     and not exists (select 1 from information_schema.columns
                     where table_name = 'accounts' and column_name = 'legal_name')
  then
    alter table accounts rename column trade_name to legal_name;
  end if;
end $$;

alter table accounts add column if not exists legal_name text;
