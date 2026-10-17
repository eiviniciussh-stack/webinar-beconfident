# Webinar BeConfident — Guia de Implantação (GitHub + Vercel)

Plataforma interna de webinar gravado da BeConfident, com a identidade visual da marca (roxo #8134FE / #20044E, fonte Rethink Sans).

Este projeto é uma plataforma completa de Webinar (com chat, contador ao vivo, ofertas com acionamento por tempo, área VIP e Painel Administrativo).

---

## 🚀 Como Colocar no Ar no Vercel (Passo a Passo)

### 1️⃣ Código no GitHub
O código já está neste repositório. Toda alteração enviada para a branch `main` é publicada automaticamente pela Vercel.

---

### 2️⃣ Importar o Projeto na Vercel
1. Acesse o painel da **[Vercel](https://vercel.com)** e faça login com sua conta do GitHub.
2. Clique em **"Add New"** ➔ **"Project"**.
3. Selecione o repositório que você acabou de subir no GitHub.
4. O Vercel irá detectar automaticamente o projeto Vite + Express através do arquivo `vercel.json` incluso no projeto.
5. Clique em **"Deploy"**.

---

## 🗄️ Banco de dados (Supabase)

Tudo (configurações, leads, progresso, comentários, dúvidas e administradores) fica salvo no Supabase.

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas e cadastra o primeiro administrador.
3. Em **Authentication → Users → Add user → Create new user**, crie o usuário do primeiro administrador (mesmo e-mail do `schema.sql`) com uma senha e marque **Auto Confirm User**.
4. Em **Project Settings → API**, copie a *Project URL*, a chave *anon public* e a chave *service_role*.
5. Na Vercel, em **Settings → Environment Variables**, crie:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Faça um novo deploy (**Deployments → ⋯ → Redeploy**).

## 🔐 Painel Administrativo

- Acesse `https://SEU-SITE.vercel.app/?admin=true` e entre com **e-mail e senha** de administrador.
- Na aba **Administradores** você adiciona ou remove quem pode entrar no painel.
- O webhook de leads (Make/Zapier/n8n) é configurado na aba **Vídeo & Smart CTA**.

## 🛠️ Recursos Incluídos para Vercel
- **`vercel.json`**: Configurado para rotear chamadas de API (`/api/*`) diretamente para as Serverless Functions (`/api/index.ts`).
- **Persistência de Dados**: configurações, bônus, materiais, inscritos e progresso ficam no Supabase (sem Supabase, em desenvolvimento local, o servidor usa `data/db.json`).
