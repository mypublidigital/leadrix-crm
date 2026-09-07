-- Aniversário do contato.
--
-- Guardado como data completa para o campo aceitar o seletor nativo do
-- navegador e permitir calcular a idade. O casamento com o período da agenda
-- usa só DIA e MÊS: aniversário se repete todo ano, o ano de nascimento não
-- entra no filtro.
alter table contacts add column if not exists birth_date date;
