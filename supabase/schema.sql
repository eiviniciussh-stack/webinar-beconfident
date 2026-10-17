-- =====================================================================
-- Webinar BeConfident — esquema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro uma vez em: Supabase > SQL Editor > New query
-- =====================================================================

-- Configurações e conteúdos editados no painel (settings, FAQ, bônus, materiais...)
create table if not exists public.wb_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Leads / participantes (id = WhatsApp ou e-mail em minúsculas)
create table if not exists public.wb_users (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Progresso de cada participante no vídeo
create table if not exists public.wb_progress (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Dúvidas enviadas pelo chat de suporte
create table if not exists public.wb_questions (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- Comentários reais enviados no chat
create table if not exists public.wb_real_comments (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- Quem está online agora (atualizado a cada ping)
create table if not exists public.wb_presence (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Quem pode entrar no painel administrativo
create table if not exists public.wb_admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- Segurança: o site acessa o banco só pelo servidor (service role).
-- Com RLS ligado e nenhuma policy, ninguém acessa essas tabelas pela chave pública.
alter table public.wb_config        enable row level security;
alter table public.wb_users         enable row level security;
alter table public.wb_progress      enable row level security;
alter table public.wb_questions     enable row level security;
alter table public.wb_real_comments enable row level security;
alter table public.wb_presence      enable row level security;
alter table public.wb_admins        enable row level security;

-- Primeiro administrador (troque se precisar)
insert into public.wb_admins (email) values ('vinicius.santos@beconfident.app')
on conflict (email) do nothing;
