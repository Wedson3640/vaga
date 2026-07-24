# Vaga

App Next.js com duas páginas:

- **`/`** — upload de currículo, extração de PDF/DOCX no navegador (pdf.js/mammoth) e busca real de vagas (Adzuna + Jooble) via Supabase.
- **`/editais`** — painel de licitações públicas de arquitetura/engenharia (PI, MA, CE, PA), varridas semanalmente do PNCP e gravadas no Supabase.

Inspirado no mascote Pip do projeto [ai-job-search](https://github.com/MadsLorentzen/ai-job-search).

## Rodando localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## Deploy

Deploy automático no Vercel (detecta Next.js pelo `package.json`, sem configuração adicional).

## Backend

O SQL das tabelas e o código das Edge Functions ficam em `supabase/` — aplicados manualmente no dashboard do Supabase (ver histórico do projeto para o passo a passo).
