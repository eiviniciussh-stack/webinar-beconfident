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

## 🔐 Como Acessar o Painel Administrativo no Ar

Assim que o projeto estiver publicado na Vercel (ou em qualquer dispositivo/celular):

1. Basta adicionar **`?admin=true`** ou **`?adm=1`** no final do seu link de produção na barra do navegador.
   - *Exemplo:* `https://seu-webinar.vercel.app/?admin=true`
2. Digite a senha administrativa para entrar no painel. Defina a senha na Vercel em **Settings → Environment Variables → `ADMIN_PASSCODE`** (padrão de desenvolvimento: `beconfident@2026`).
3. O webhook de leads (Make/Zapier/n8n) é configurado no painel, na aba **Vídeo & Smart CTA**.

---

## 🛠️ Recursos Incluídos para Vercel
- **`vercel.json`**: Configurado para rotear chamadas de API (`/api/*`) diretamente para as Serverless Functions (`/api/index.ts`).
- **Persistência de Dados**: Todas as configurações, bônus, materiais, dados de inscritos e progresso do aluno são gerenciados automaticamente pelo backend.
