-- Candidatos: um registro por currículo enviado
create table candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  file_name text not null,
  file_path text not null, -- caminho no bucket "curriculos"
  desired_role text not null, -- cargo/palavras-chave digitadas pelo usuário
  location text, -- cidade/estado opcional, usado como filtro na busca
  keywords text[] not null default '{}' -- palavras extraídas de desired_role, usadas no matching
);

-- Uma solicitação de busca disparada pelo botão "Iniciar busca"
create table search_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  candidate_id uuid not null references candidates(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  error_message text
);

-- Cache das vagas reais trazidas da Adzuna (evita rebuscar a mesma vaga)
create table job_postings (
  id uuid primary key default gen_random_uuid(),
  fetched_at timestamptz not null default now(),
  source text not null default 'adzuna',
  external_id text not null,
  title text not null,
  company text,
  location text,
  description text,
  url text,
  salary_min numeric,
  salary_max numeric,
  unique (source, external_id)
);

-- Vagas retornadas para uma busca específica, com o score de compatibilidade calculado
create table search_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  search_request_id uuid not null references search_requests(id) on delete cascade,
  job_posting_id uuid not null references job_postings(id) on delete cascade,
  match_score numeric not null,
  matched_keywords text[] not null default '{}',
  unique (search_request_id, job_posting_id)
);

-- Row Level Security
-- Este é um MVP sem login: qualquer visitante pode criar uma busca e ler o resultado dela.
-- candidates guarda o nome/caminho do arquivo e não é exposto para leitura pública.
alter table candidates enable row level security;
alter table search_requests enable row level security;
alter table job_postings enable row level security;
alter table search_results enable row level security;

create policy "candidates: anyone can insert" on candidates
  for insert to anon with check (true);
-- Sem policy de select: só a Edge Function (service role) lê a tabela candidates.

create policy "search_requests: anyone can insert" on search_requests
  for insert to anon with check (true);
create policy "search_requests: anyone can read by id" on search_requests
  for select to anon using (true);

create policy "job_postings: public read" on job_postings
  for select to anon using (true);

create policy "search_results: public read" on search_results
  for select to anon using (true);

-- Storage: bucket privado para os arquivos de currículo (criado via dashboard ou API, ver README)
