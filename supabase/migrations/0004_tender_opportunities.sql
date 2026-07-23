-- Licitações públicas (PNCP) que batem com palavras-chave de arquitetura,
-- encontradas pela varredura semanal da Edge Function scan-tenders.
create table tender_opportunities (
  id uuid primary key default gen_random_uuid(),
  pncp_control_number text not null unique, -- numeroControlePNCP, chave de dedup
  objeto text not null,                     -- objetoCompra
  orgao text,                               -- orgaoEntidade.razaoSocial
  uf text,
  municipio text,
  modalidade text,                          -- modalidadeNome
  valor_estimado numeric,
  data_publicacao timestamptz,
  data_encerramento_proposta timestamptz,
  link text,                                -- linkSistemaOrigem
  matched_keywords text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

alter table tender_opportunities enable row level security;

create policy "tender_opportunities: public read" on tender_opportunities
  for select to anon using (true);
-- Sem policy de insert/update para anon: só a Edge Function (service role) escreve.
