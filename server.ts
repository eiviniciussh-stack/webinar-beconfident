import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from './server/db.js';
import { registerAuthRoutes, requireAdmin, getAdminEmail } from './server/auth.js';
import { registerSupportRoutes } from './server/support.js';
import { WebinarStats } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Active online users tracking in memory
const activeUsersMap = new Map<string, { name: string; timestamp: number }>();

// Helper to fire webhooks formatted with both URL query params and form body
// so platforms like Make.com (Integromat), Zapier, and n8n automatically extract
// discrete variables (event, name, whatsapp, etc.) into separate bundle items.
async function fireWebhook(rawUrl: string, payload: Record<string, any>) {
  if (!rawUrl || !rawUrl.trim()) return;
  const baseUrl = rawUrl.trim();

  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(payload)) {
    if (val !== undefined && val !== null) {
      params.append(key, String(val));
    }
  }

  const fullUrl = baseUrl.includes('?')
    ? `${baseUrl}&${params.toString()}`
    : `${baseUrl}?${params.toString()}`;

  return fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
}

// Cleanup inactive users periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [email, data] of activeUsersMap.entries()) {
    if (now - data.timestamp > 15000) {
      activeUsersMap.delete(email);
    }
  }
}, 10000);
if (cleanupInterval && typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ipStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = ipStr.split(',')[0].trim();
    if (ip && ip !== '::1' && ip !== '127.0.0.1' && ip !== 'localhost') return ip;
  }
  const remote = req.socket.remoteAddress || '';
  if (remote === '::1' || remote === '127.0.0.1') return '187.32.11.45';
  const cleaned = remote.replace(/^.*:/, '');
  return (cleaned && cleaned !== '127.0.0.1') ? cleaned : '187.32.11.45';
}

function parseUserDevice(uaHeader: string | undefined, bodyDevice?: string): string {
  if (bodyDevice && bodyDevice.trim()) return bodyDevice.trim();
  if (!uaHeader) return 'Desktop';
  if (/iPhone/i.test(uaHeader)) return 'Mobile (iPhone)';
  if (/Android/i.test(uaHeader) && /mobile/i.test(uaHeader)) return 'Mobile (Android)';
  if (/iPad/i.test(uaHeader)) return 'Tablet (iPad)';
  if (/mobile/i.test(uaHeader)) return 'Mobile';
  if (/Windows/i.test(uaHeader)) return 'Desktop (Windows)';
  if (/Macintosh/i.test(uaHeader)) return 'Desktop (Mac)';
  return 'Desktop';
}

// --- API ROUTES ---

// Keep the in-memory cache in sync with Supabase (skipped for the high-frequency ping routes)
app.use('/api', async (req, _res, next) => {
  if (req.path.startsWith('/ping')) return next();
  try {
    await db.ensureFresh();
    next();
  } catch (err) {
    next(err);
  }
});

registerAuthRoutes(app);
registerSupportRoutes(app);

// 0. DB Status
app.get('/api/db-status', requireAdmin, async (req, res, next) => {
  try {
    res.json({ status: "online", storage: db.storageLabel() });
  } catch (err) {
    next(err);
  }
});

// 1. Settings
app.get('/api/settings', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    if (await getAdminEmail(req)) return res.json(settings);
    // Hide integration details from the public room
    const { webhookUrl, webhookEnabled, ...publicSettings } = settings as any;
    res.json(publicSettings);
  } catch (err) {
    next(err);
  }
});

app.post('/api/settings', requireAdmin, async (req, res, next) => {
  try {
    const updated = await db.updateSettings(req.body);
    await db.saveAsDefault();
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.post('/api/save-defaults', requireAdmin, async (req, res, next) => {
  try {
    if (req.body && Object.keys(req.body).length > 0) {
      await db.updateSettings(req.body);
    }
    await db.saveAsDefault();
    res.json({ success: true, message: 'Configuração atual salva como padrão com sucesso!' });
  } catch (err) {
    next(err);
  }
});

// 2. Stats & Live Map Analytics
app.get('/api/stats', requireAdmin, async (req, res, next) => {
  try {
    const users = await db.getUsers();
    const questions = await db.getQuestions();
    const ctaClicks = await db.getCtaClicks();
    const progressList = await db.getProgress();

    const activeCount = db.getActiveUsersCount();
    const stats: WebinarStats = {
      totalUsers: users.length,
      activeUsers: activeCount,
      peakUsers: db.getPeakUsers(),
      avgWatchTime: progressList.length > 0 
        ? Math.round(progressList.reduce((acc, p) => acc + p.watchedSeconds, 0) / progressList.length) 
        : 0,
      questionsCount: questions.length,
      ctaClicks
    };
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

app.get('/api/analytics/live-map', requireAdmin, async (req, res, next) => {
  try {
    const liveMapData = await db.getLiveMapData();
    res.json(liveMapData);
  } catch (err) {
    next(err);
  }
});


// 3. User Login / Registration
app.post('/api/users/login', async (req, res, next) => {
  try {
    const { name, email, device } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios' });
    }
    const clientIp = getClientIp(req);
    const userDevice = parseUserDevice(req.headers['user-agent'], device);
    const user = await db.createUser(name.trim(), email.trim(), userDevice, clientIp);
    
    // Register active user ping in DB
    await db.pingUser(email, name, userDevice, clientIp);

    // Trigger webhook if configured
    const settings = await db.getSettings();
    if (settings.webhookUrl && settings.webhookUrl.trim()) {
      fireWebhook(settings.webhookUrl, {
        event: 'lead_registration',
        name: user.name,
        email: user.email,
        whatsapp: user.email,
        device: userDevice,
        ip: clientIp,
        createdAt: user.createdAt,
        timestamp: new Date().toISOString()
      }).catch(e => console.error('Error firing user webhook:', e));
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Ping route for live attendance calculation
app.post('/api/ping', async (req, res, next) => {
  try {
    const { email, name, device, webinarId } = req.body || {};
    const clientIp = getClientIp(req);
    const userDevice = parseUserDevice(req.headers['user-agent'], device);
    const resPing = await db.pingUser(email || '', name || '', userDevice, clientIp, webinarId ? String(webinarId) : undefined);
    res.json({ status: 'ok', onlineNow: resPing.onlineNow });
  } catch (err) {
    next(err);
  }
});

app.post('/api/ping/offline', express.text({ type: '*/*' }), async (req, res, next) => {
  try {
    let email = '';
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        email = parsed.email || '';
      } catch (e) {
        email = req.body;
      }
    } else if (req.body && req.body.email) {
      email = req.body.email;
    }
    if (email) {
      await db.disconnectUser(email);
    }
    res.json({ status: 'offline' });
  } catch (err) {
    res.status(200).json({ status: 'ok' });
  }
});

// 4. Questions
app.get('/api/questions', async (req, res, next) => {
  try {
    const questions = await db.getQuestions();
    if (await getAdminEmail(req)) return res.json(questions);
    // Participants only see their own questions
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.json([]);
    res.json(questions.filter(q => (q.email || '').trim().toLowerCase() === email));
  } catch (err) {
    next(err);
  }
});

app.post('/api/questions', async (req, res, next) => {
  try {
    const { name, email, question, userId } = req.body;
    if (!name || !question) {
      return res.status(400).json({ error: 'Nome e pergunta são obrigatórios' });
    }
    const q = await db.addQuestion(name, email || '', question, userId);

    // Trigger webhook if configured
    const settings = await db.getSettings();
    if (settings.webhookUrl && settings.webhookUrl.trim()) {
      fireWebhook(settings.webhookUrl, {
        event: 'question_asked',
        name,
        email: email || '',
        question,
        userId: userId || '',
        timestamp: new Date().toISOString()
      }).catch(e => console.error('Error firing question webhook:', e));
    }

    res.json(q);
  } catch (err) {
    next(err);
  }
});

app.post('/api/questions/:id/answer', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    if (!answer) return res.status(400).json({ error: 'Resposta é obrigatória' });

    const q = await db.answerQuestion(id, answer);
    if (!q) return res.status(404).json({ error: 'Pergunta não encontrada' });
    res.json(q);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/questions/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = await db.deleteQuestion(id);
    if (!success) return res.status(404).json({ error: 'Pergunta não encontrada' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 5. Sync Comments
app.get('/api/comments', async (req, res, next) => {
  try {
    const comments = await db.getComments();
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

app.post('/api/comments', requireAdmin, async (req, res, next) => {
  try {
    const saved = await db.saveComments(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// 5b. Real Audience Comments
app.get('/api/real-comments', async (req, res, next) => {
  try {
    const comments = await db.getRealComments();
    res.json(comments);
  } catch (err) {
    next(err);
  }
});

app.post('/api/real-comments', async (req, res, next) => {
  try {
    const { name, message, time, photoUrl } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: 'Nome e mensagem são obrigatórios' });
    }
    const newComment = await db.addRealComment(name, message, time || 0, photoUrl);
    res.json(newComment);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/real-comments/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.deleteRealComment(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/real-comments', requireAdmin, async (req, res, next) => {
  try {
    await db.clearRealComments();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/real-comments/clear', requireAdmin, async (req, res, next) => {
  try {
    await db.clearRealComments();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 6. Materials
app.get('/api/materials', async (req, res, next) => {
  try {
    const materials = await db.getMaterials();
    res.json(materials);
  } catch (err) {
    next(err);
  }
});

app.post('/api/materials', requireAdmin, async (req, res, next) => {
  try {
    const saved = await db.saveMaterials(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// 7. Bonuses
app.get('/api/bonuses', async (req, res, next) => {
  try {
    const bonuses = await db.getBonuses();
    res.json(bonuses);
  } catch (err) {
    next(err);
  }
});

app.post('/api/bonuses', requireAdmin, async (req, res, next) => {
  try {
    const saved = await db.saveBonuses(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// 8. FAQ
app.get('/api/faq', async (req, res, next) => {
  try {
    const faq = await db.getFAQ();
    res.json(faq);
  } catch (err) {
    next(err);
  }
});

app.post('/api/faq', requireAdmin, async (req, res, next) => {
  try {
    const saved = await db.saveFAQ(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// 9. Testimonials
app.get('/api/testimonials', async (req, res, next) => {
  try {
    const testimonials = await db.getTestimonials();
    res.json(testimonials);
  } catch (err) {
    next(err);
  }
});

app.post('/api/testimonials', requireAdmin, async (req, res, next) => {
  try {
    const saved = await db.saveTestimonials(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// 10. Progress Tracking
app.get('/api/progress', requireAdmin, async (req, res, next) => {
  try {
    const progress = await db.getProgress();
    res.json(progress);
  } catch (err) {
    next(err);
  }
});

app.post('/api/progress', async (req, res, next) => {
  try {
    const { userId, email, name, watchedSeconds, durationSeconds, device } = req.body;
    if (!userId || !email) return res.status(400).json({ error: 'userId e email são obrigatórios' });
    const clientIp = getClientIp(req);
    const userDevice = parseUserDevice(req.headers['user-agent'], device);
    const record = await db.saveProgress(userId, email, name || 'Aluno', watchedSeconds || 0, durationSeconds || 0, userDevice, clientIp);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

// 11. CTA Clicks
app.post('/api/cta/click', async (req, res, next) => {
  try {
    const { userId, email } = req.body || {};
    const clicks = await db.incrementCtaClicks(userId, email);
    
    // Trigger webhook if enabled
    const settings = await db.getSettings();
    const webhookUrl = settings.webhookUrl || process.env.WEBHOOK_URL;
    if (webhookUrl && webhookUrl.trim() && settings.webhookEnabled !== false) {
      fireWebhook(webhookUrl, {
        event: 'cta_clicked',
        userId,
        email,
        totalClicks: clicks,
        timestamp: new Date().toISOString()
      }).catch(e => console.error('Error firing CTA webhook:', e));
    }

    res.json({ success: true, ctaClicks: clicks });
  } catch (err) {
    next(err);
  }
});

// 11a. Landing page visits (for the dashboard funnel)
app.post('/api/track/visit', async (_req, res) => {
  try {
    await db.trackVisit();
  } catch (err) {
    console.error('visit tracking error', err);
  }
  res.json({ ok: true });
});

app.get('/api/analytics/visits', requireAdmin, async (_req, res) => {
  res.json(db.getVisits());
});

// 11b. Leads Management
app.get('/api/leads', requireAdmin, async (req, res, next) => {
  try {
    const leads = await db.getLeads();
    res.json(leads);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/leads/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.deleteLead(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/leads/delete', requireAdmin, async (req, res, next) => {
  try {
    const { id, email } = req.body || {};
    await db.deleteLead(id || '', email || '');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/leads/toggle-cta', requireAdmin, async (req, res, next) => {
  try {
    const { id, email, clickedCta } = req.body || {};
    const success = await db.toggleLeadCta(id, email, clickedCta);
    res.json({ success });
  } catch (err) {
    next(err);
  }
});

// 12. Test Webhook
app.post('/api/test-webhook', requireAdmin, async (req, res, next) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) return res.status(400).json({ error: 'URL do webhook é obrigatória' });

    const response = await fireWebhook(webhookUrl, {
      event: 'test_ping',
      message: 'Teste de integração enviado pelo Painel Administrativo do Webinar.',
      timestamp: new Date().toISOString()
    });

    res.json({
      success: response ? response.ok : false,
      status: response ? response.status : 500,
      statusText: response ? response.statusText : 'Error'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Erro ao conectar com o servidor de Webhook'
    });
  }
});

// Catch-all 404 handler for unmatched /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.url}` });
});

// Global Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API ERROR]', err);
  if (!res.headersSent) {
    res.status(500).json({
      error: err?.message || 'Erro interno no servidor',
      details: String(err)
    });
  }
});

// Serve static files in production mode or mount Vite in dev mode
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) res.sendFile(indexPath);
        else next();
      });
    }
  } else {
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('Failed to load Vite middleware:', e);
    }
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Webinar server running on http://0.0.0.0:${PORT}`);
    });
  }
}

// Only start standalone HTTP server and Vite middleware if NOT running on Vercel Serverless
if (!process.env.VERCEL && !process.env.NOW_REGION) {
  startServer();
}

export default app;
