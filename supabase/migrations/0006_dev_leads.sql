-- Leads de desenvolvimento encontrados na thread mensal "Ask HN: Who is
-- hiring?" do Hacker News, filtrados por sinais de contrato/freelance.
create table dev_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'hackernews',
  external_id text not null unique, -- objectID do comentário no HN (dedup)
  author text,
  snippet text not null,             -- texto do comentário (a vaga em si)
  url text not null,                 -- link pro comentário no HN
  posted_at timestamptz,             -- created_at do comentário
  matched_keywords text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

alter table dev_leads enable row level security;

create policy "dev_leads: public read" on dev_leads
  for select to anon using (true);
-- Sem policy de insert/update para anon: só a Edge Function (service role) escreve.
