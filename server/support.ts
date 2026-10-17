import express from 'express';
import { db } from './db.js';
import { requireAdmin } from './auth.js';
import { Webinar, SupportRoom } from '../src/types.js';

const MAIN_ID = 'principal';

/** The original always-on room ("ao vivo full timing" / just in time), configured in "Vídeos". */
async function mainWebinar(): Promise<Webinar> {
  const s = await db.getSettings();
  return {
    id: MAIN_ID,
    type: 'jit',
    name: 'Sala principal (just in time)',
    title: s.title,
    slug: '',
    description: s.description,
    videoUrl: s.videoUrl,
    isActive: s.isLiveActive !== false,
    createdAt: '',
  };
}

export function isLive(w: Webinar, now = Date.now()): boolean {
  if (!w.isActive) return false;
  if (w.type === 'jit') return true;
  const start = w.startAt ? new Date(w.startAt).getTime() : NaN;
  const end = w.endAt ? new Date(w.endAt).getTime() : NaN;
  return !isNaN(start) && !isNaN(end) && now >= start && now <= end;
}

function status(w: Webinar, now = Date.now()): 'ao_vivo' | 'agendado' | 'encerrado' | 'pausado' {
  if (!w.isActive) return 'pausado';
  if (w.type === 'jit') return 'ao_vivo';
  const start = w.startAt ? new Date(w.startAt).getTime() : NaN;
  const end = w.endAt ? new Date(w.endAt).getTime() : NaN;
  if (!isNaN(end) && now > end) return 'encerrado';
  if (!isNaN(start) && now < start) return 'agendado';
  return 'ao_vivo';
}

const slugify = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

function sanitize(input: any, existing?: Webinar): Webinar {
  const now = new Date().toISOString();
  const durationMinutes = Math.max(1, Math.min(24 * 60, Number(input.durationMinutes ?? existing?.durationMinutes ?? 60) || 60));
  const startAt = input.startAt ? new Date(input.startAt).toISOString() : existing?.startAt;
  const endAt = startAt ? new Date(new Date(startAt).getTime() + durationMinutes * 60_000).toISOString() : undefined;
  return {
    id: existing?.id || 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: 'unico',
    name: String(input.name ?? existing?.name ?? '').trim().slice(0, 120) || 'Webinar sem nome',
    title: String(input.title ?? existing?.title ?? '').trim().slice(0, 200),
    slug: slugify(String(input.slug ?? existing?.slug ?? input.name ?? '')),
    description: String(input.description ?? existing?.description ?? '').slice(0, 1000),
    videoUrl: String(input.videoUrl ?? existing?.videoUrl ?? '').trim(),
    startAt,
    durationMinutes,
    endAt,
    isActive: input.isActive !== undefined ? !!input.isActive : existing?.isActive ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function registerSupportRoutes(app: express.Express) {
  // ---------- Public: room info for /w/<slug> ----------
  app.get('/api/webinars/public/:slug', async (req, res) => {
    const slug = slugify(req.params.slug || '');
    const w = db.getWebinars().find((x) => x.slug === slug);
    if (!w || !w.isActive) return res.status(404).json({ error: 'Webinar não encontrado.' });
    res.json({ ...w, status: status(w), serverNow: new Date().toISOString() });
  });

  // ---------- Admin: webinars CRUD ----------
  app.get('/api/webinars', requireAdmin, async (_req, res, next) => {
    try {
      const main = await mainWebinar();
      const list = db.getWebinars().map((w) => ({ ...w, status: status(w) }));
      res.json([{ ...main, status: status(main) }, ...list]);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/webinars', requireAdmin, async (req, res, next) => {
    try {
      const w = sanitize(req.body || {});
      if (!w.videoUrl) return res.status(400).json({ error: 'Informe o link do vídeo.' });
      if (!w.startAt) return res.status(400).json({ error: 'Informe a data e hora de início.' });
      if (!w.slug) return res.status(400).json({ error: 'Informe o link (URL amigável).' });
      const list = db.getWebinars();
      if (list.some((x) => x.slug === w.slug)) return res.status(400).json({ error: 'Já existe um webinar com esse link.' });
      await db.saveWebinars([...list, w]);
      res.json(w);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/webinars/:id', requireAdmin, async (req, res, next) => {
    try {
      const list = db.getWebinars();
      const idx = list.findIndex((x) => x.id === req.params.id);
      if (idx < 0) return res.status(404).json({ error: 'Webinar não encontrado.' });
      const w = sanitize(req.body || {}, list[idx]);
      if (list.some((x) => x.slug === w.slug && x.id !== w.id)) return res.status(400).json({ error: 'Já existe um webinar com esse link.' });
      const next = [...list];
      next[idx] = w;
      await db.saveWebinars(next);
      res.json(w);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/webinars/:id', requireAdmin, async (req, res, next) => {
    try {
      await db.saveWebinars(db.getWebinars().filter((x) => x.id !== req.params.id));
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // ---------- Public: lead side of the support chat ----------
  app.post('/api/support/messages', async (req, res, next) => {
    try {
      const { webinarId, email, name, text } = req.body || {};
      const clean = String(text || '').trim().slice(0, 2000);
      if (!email || !clean) return res.status(400).json({ error: 'Mensagem vazia.' });
      const t = await db.leadMessage(String(webinarId || MAIN_ID), String(email), String(name || 'Participante'), clean);
      res.json(t);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/support/my', async (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    const webinarId = String(req.query.webinarId || MAIN_ID);
    if (!email) return res.json([]);
    const list = db
      .getTickets(webinarId)
      .filter((t) => t.leadEmail.trim().toLowerCase() === email && !t.dismissed)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((t) => ({ id: t.id, status: t.status, messages: t.messages, createdAt: t.createdAt }));
    res.json(list);
  });

  // ---------- Admin: atendimento ----------
  app.get('/api/support/rooms', requireAdmin, async (_req, res, next) => {
    try {
      const counts = await db.roomCounts();
      const all = [await mainWebinar(), ...db.getWebinars()];
      const now = Date.now();
      const rooms: (SupportRoom & { status: string })[] = all
        .filter((w) => w.isActive && status(w, now) !== 'encerrado')
        .map((w) => ({
          webinar: w,
          live: isLive(w, now),
          status: status(w, now),
          viewers: counts[w.id]?.viewers || 0,
          agents: counts[w.id]?.agents || 0,
          waiting: db.getTickets(w.id).filter((t) => t.status === 'open').length,
        }))
        .sort((a, b) => Number(b.live) - Number(a.live));
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/support/rooms/:webinarId', requireAdmin, async (req, res, next) => {
    try {
      const webinarId = req.params.webinarId;
      const me = (req as any).adminEmail as string;
      await db.agentPing(webinarId, me);
      await db.ensureFresh(true);
      const counts = await db.roomCounts();
      const w = webinarId === MAIN_ID ? await mainWebinar() : db.getWebinars().find((x) => x.id === webinarId);
      if (!w) return res.status(404).json({ error: 'Webinar não encontrado.' });
      const tickets = db.getTickets(webinarId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json({
        webinar: w,
        live: isLive(w),
        me,
        viewers: counts[webinarId]?.viewers || 0,
        agents: Math.max(1, counts[webinarId]?.agents || 0),
        tickets,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/support/tickets/:id/:action', requireAdmin, async (req, res, next) => {
    try {
      const me = (req as any).adminEmail as string;
      const { id, action } = req.params;
      let t;
      if (action === 'messages') {
        const text = String(req.body?.text || '').trim().slice(0, 2000);
        if (!text) return res.status(400).json({ error: 'Mensagem vazia.' });
        t = await db.agentMessage(id, me, text);
      } else if (['assign', 'dismiss', 'close', 'read'].includes(action)) {
        t = await db.updateTicketStatus(id, me, action as any);
      } else {
        return res.status(404).json({ error: 'Ação desconhecida.' });
      }
      if (!t) return res.status(404).json({ error: 'Atendimento não encontrado.' });
      res.json(t);
    } catch (err) {
      next(err);
    }
  });
}
