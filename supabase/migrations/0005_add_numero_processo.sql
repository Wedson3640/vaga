-- Número e ano do processo de compra (ex: "012/2026"), separados do
-- pncp_control_number (que é o identificador técnico, não o número que
-- aparece no edital). Usados para exibir "Concorrência Eletrônica nº 012/2026"
-- na interface, em vez do número de controle interno do PNCP.
alter table tender_opportunities add column numero_compra text;
alter table tender_opportunities add column ano_compra integer;
