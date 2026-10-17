import express from 'express';
import { sbAdmin, sbAuth, store, isSupabaseEnabled } from './supabase.js';

/** In local development without Supabase the panel is open (never in production). */
const isLocalDev = !isSupabaseEnabled && !process.env.VERCEL && process.env.NODE_ENV !== 'production';

const tokenCache = new Map<string, { email: string; exp: number }>();

function bearer(req: express.Request): string {
  const h = req.headers.authorization || '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : '';
}

/** Returns the admin e-mail for a valid token, or null. */
export async function getAdminEmail(req: express.Request): Promise<string | null> {
  if (isLocalDev) return 'dev@local';
  if (!sbAdmin) return null;
  const token = bearer(req);
  if (!token) return null;

  const cached = tokenCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.email;

  const { data, error } = await sbAdmin.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return null;
  if (!(await store.isAdminEmail(email))) return null;

  tokenCache.set(token, { email, exp: Date.now() + 60_000 });
  if (tokenCache.size > 500) tokenCache.clear();
  return email;
}

export const requireAdmin: express.RequestHandler = async (req, res, next) => {
  try {
    const email = await getAdminEmail(req);
    if (!email) {
      return res.status(401).json({ error: 'Faça login como administrador para continuar.' });
    }
    (req as any).adminEmail = email;
    next();
  } catch (err) {
    next(err);
  }
};

function sessionPayload(session: any, email: string) {
  return {
    email,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}

export function registerAuthRoutes(app: express.Express) {
  app.get('/api/admin/config', (_req, res) => {
    res.json({ supabase: isSupabaseEnabled, localDev: isLocalDev });
  });

  // E-mail + password login for administrators (Supabase Auth)
  app.post('/api/admin/login', async (req, res, next) => {
    try {
      if (isLocalDev) {
        return res.json({ email: 'dev@local', access_token: 'dev', refresh_token: 'dev', expires_at: Math.floor(Date.now() / 1000) + 86400 });
      }
      if (!sbAuth || !sbAdmin) {
        return res.status(503).json({ error: 'Banco de dados (Supabase) ainda não configurado na Vercel.' });
      }
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

      const { data, error } = await sbAuth.auth.signInWithPassword({ email, password });
      if (error || !data.session) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      if (!(await store.isAdminEmail(email))) {
        return res.status(403).json({ error: 'Este usuário não tem acesso ao painel administrativo.' });
      }
      res.json(sessionPayload(data.session, email));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/refresh', async (req, res, next) => {
    try {
      if (isLocalDev) return res.json({ email: 'dev@local', access_token: 'dev', refresh_token: 'dev', expires_at: Math.floor(Date.now() / 1000) + 86400 });
      if (!sbAuth) return res.status(503).json({ error: 'Supabase não configurado.' });
      const refresh_token = String(req.body?.refresh_token || '');
      if (!refresh_token) return res.status(400).json({ error: 'Sessão expirada.' });
      const { data, error } = await sbAuth.auth.refreshSession({ refresh_token });
      const email = data?.user?.email?.toLowerCase() || '';
      if (error || !data.session || !email || !(await store.isAdminEmail(email))) {
        return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
      }
      res.json(sessionPayload(data.session, email));
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/admin/me', requireAdmin, (req, res) => {
    res.json({ email: (req as any).adminEmail });
  });

  // ---- Administrator management (only for logged-in admins) ----
  app.get('/api/admin/users', requireAdmin, async (_req, res, next) => {
    try {
      if (!isSupabaseEnabled) return res.json([]);
      res.json(await store.listAdmins());
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/users', requireAdmin, async (req, res, next) => {
    try {
      if (!sbAdmin) return res.status(503).json({ error: 'Supabase não configurado.' });
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'E-mail inválido.' });
      if (password.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' });

      const { error } = await sbAdmin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error && !/already|registered|exists/i.test(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      await store.addAdminEmail(email);
      res.json({ success: true, existed: !!error });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/admin/users/:email', requireAdmin, async (req, res, next) => {
    try {
      const email = decodeURIComponent(req.params.email || '').trim().toLowerCase();
      if (email === (req as any).adminEmail) {
        return res.status(400).json({ error: 'Você não pode remover o seu próprio acesso.' });
      }
      await store.removeAdminEmail(email);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });
}
