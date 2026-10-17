import fs from 'fs';
import path from 'path';
import { 
  User, Settings, SyncComment, UserQuestion, 
  Material, FAQItem, Bonus, Testimonial, UserProgress, LeadInfo,
  LiveAnalyticsMapData, GeoViewer, DeviceBreakdown, Webinar, SupportTicket, SupportMessage
} from '../src/types.js';
import { resolveIp, getFallbackLocation } from './geo.js';
import { store, isSupabaseEnabled } from './supabase.js';

const keyOf = (v?: string) => (v || '').trim().toLowerCase();
const PRESENCE_WINDOW_MS = 25000;
const SYNC_TTL_MS = 3000;

interface DatabaseSchema {
  settings: Settings;
  users: User[];
  comments: SyncComment[];
  questions: UserQuestion[];
  materials: Material[];
  bonuses: Bonus[];
  faq: FAQItem[];
  testimonials: Testimonial[];
  progress: UserProgress[];
  ctaClicks: number;
  realComments: SyncComment[];
  activeUsers?: Record<string, { name: string; timestamp: number; device?: string; ip?: string; webinarId?: string }>;
  peakUsers?: number;
  visits?: Record<string, number>;
  webinars?: Webinar[];
}

const DEFAULT_SETTINGS: Settings = {
  logoText: "Webinar BeConfident",
  badgeText: "Aula online e gratuita",
  highlightText: "falar inglês com confiança",
  title: "Descubra como falar inglês com confiança em poucas semanas.",
  description: "Uma aula exclusiva da BeConfident sobre o método que combina Masters e mentores de IA para destravar sua conversação.",
  videoUrl: "https://www.youtube.com/watch?v=tHuwcSRj9ms",
  ctaType: "time",
  ctaTriggerValue: 30,
  ctaText: "Agende uma conversa e descubra o plano ideal para você destravar o inglês.",
  ctaLink: "https://beconfident.app",
  primaryColor: "#8134FE",
  secondaryColor: "#20044E",
  offerDuration: 600,
  liveMinUsers: 20,
  liveMaxUsers: 35,
  offerTitle: "Comece hoje na BeConfident",
  offerBtnText: "QUERO COMEÇAR",
  tabOfferTitle: "Comece hoje na BeConfident",
  tabOfferSubtitle: "Agende uma conversa e descubra o plano ideal para você destravar o inglês.",
  tabOfferDescription: "✓ Aulas com Masters e mentores de IA\n✓ Pratique no WhatsApp e no App\n✓ Plano adaptado aos seus objetivos",
  webhookUrl: "",
  webhookEnabled: false,
  isLiveActive: true
};

const DEFAULT_COMMENTS: SyncComment[] = [
  { id: "c1", time: 10, name: "Carlos Silva", photoUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", message: "Boa noite pessoal! Animado demais para começar." },
  { id: "c2", time: 25, name: "Patricia Souza", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", message: "O áudio e o vídeo estão ótimos por aqui!" },
  { id: "c3", time: 45, name: "Marcos Oliveira", photoUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80", message: "Essa introdução já valeu meu tempo inteiro!" },
  { id: "c4", time: 70, name: "Renata Costa", photoUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80", message: "Trabalho com isso há meses e nunca vi essa abordagem. Sensacional." },
  { id: "c5", time: 110, name: "Juliano Neto", photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80", message: "Estou anotando absolutamente tudo. Conteúdo absurdo de bom." },
  { id: "c6", time: 150, name: "Fernanda Dias", photoUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80", message: "Qual o link dos materiais que você comentou na introdução?" },
  { id: "c7", time: 190, name: "Diego Almeida", photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80", message: "A planilha de métricas na aba Materiais é fantástica!" },
  { id: "c8", time: 240, name: "Thiago Rocha", photoUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&h=150&q=80", message: "Didática perfeita. Muito direto ao ponto." },
  { id: "c9", time: 290, name: "Sabrina Luz", photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80", message: "Nossa, isso resolve um gargalo enorme que eu tinha aqui." }
];

const DEFAULT_MATERIALS: Material[] = [
  { id: "m1", title: "Mapa Mental: Estrutura de Lançamento de Alta Conversão", type: "PDF", url: "#", description: "O guia visual completo dos 3 pilares do webinar de vendas." },
  { id: "m2", title: "Planilha de Planejamento de Métricas Financeiras", type: "Planilha", url: "#", description: "Calcule seu ROI, custo por lead e faturamento estimado." },
  { id: "m3", title: "Checklist do Setup de Webinar Perfeito", type: "Checklist", url: "#", description: "Não comece seu webinar sem antes marcar todos estes itens de segurança." },
  { id: "m4", title: "Acesso ao Nosso Grupo VIP de Network", type: "Link", url: "https://telegram.org", description: "Entre no canal e conecte-se com outros players do mercado." }
];

const DEFAULT_FAQ: FAQItem[] = [
  { id: "f1", question: "Como recebo o acesso ao treinamento completo?", answer: "O acesso é 100% imediato! Logo após a confirmação do pagamento, você receberá um e-mail com seus dados de login e senha para acessar nossa área de membros exclusiva.", order: 1 },
  { id: "f2", question: "Quais são as formas de pagamento disponíveis?", answer: "Você pode realizar o pagamento via Pix (com aprovação imediata), cartão de crédito em até 12 parcelas (podendo usar dois cartões se preferir), ou boleto bancário.", order: 2 },
  { id: "f3", question: "Como funciona a garantia incondicional de 7 dias?", answer: "Temos tanta confiança no nosso método que oferecemos uma Garantia Blindada de 7 dias. Se você entrar e achar que não é para você, basta enviar um e-mail ao nosso suporte dentro do prazo e devolvemos 100% do seu investimento, sem perguntas ou burocracia.", order: 3 },
  { id: "f4", question: "Por quanto tempo terei acesso ao material gravado e bônus?", answer: "O acesso à gravação deste webinar e a todos os bônus oferecidos hoje é vitalício! Você poderá assistir no seu próprio ritmo, quantas vezes desejar.", order: 4 },
  { id: "f5", question: "Eu preciso ter experiência prévia ou produtos prontos?", answer: "Não! O método foi estruturado para levar você do absoluto zero até os primeiros resultados. Ensinamos como escolher nicho, criar ofertas e atrair público qualificado.", order: 5 }
];

const DEFAULT_BONUSES: Bonus[] = [
  { id: "b1", title: "Comunidade VIP Secreta de Alunos", description: "Faça networking com os maiores players do mercado, feche parcerias e acelere seu aprendizado em um ecossistema focado em resultados.", value: "R$ 997", imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&h=250&q=80" },
  { id: "b2", title: "Sessões Mensais de Mentoria Ao Vivo", description: "Participe de chamadas em grupo mensais via Zoom diretamente com nossa equipe para tirar suas dúvidas de implementação e receber feedbacks.", value: "R$ 1.997", imageUrl: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=400&h=250&q=80" },
  { id: "b3", title: "Biblioteca Secreta de Templates de Alta Conversão", description: "Copie e cole nossos modelos de páginas de captura, páginas de vendas, criativos de anúncios e sequências completas de emails.", value: "R$ 497", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=400&h=250&q=80" }
];

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: "t1", name: "Aline Torres", photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80", rating: 5, text: "Esse webinar mudou totalmente o rumo do meu negócio digital. Em menos de 30 dias aplicando as técnicas de retenção e roteiro de vendas, consegui duplicar minhas conversões de mentoria." },
  { id: "t2", name: "Felipe Silveira", photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80", rating: 5, text: "Já comprei cursos de R$ 2.000 que não entregaram metade do valor prático que esse webinar gratuito forneceu. A didática é incrível e o passo a passo é extremamente acionável." },
  { id: "t3", name: "Gabriela Mendes", photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", rating: 5, text: "Sem enrolação, direto ao ponto e com dados reais. Fiquei presa na tela do início ao fim. O suporte é maravilhoso e as planilhas extras ajudaram demais a organizar meu funil." }
];

class Database {
  private data: DatabaseSchema;
  private lastSync = 0;
  private syncing: Promise<void> | null = null;
  readonly remote = isSupabaseEnabled;

  constructor() {
    this.data = {
      settings: { ...DEFAULT_SETTINGS },
      users: [],
      comments: [...DEFAULT_COMMENTS],
      questions: [],
      materials: [...DEFAULT_MATERIALS],
      bonuses: [...DEFAULT_BONUSES],
      faq: [...DEFAULT_FAQ],
      testimonials: [...DEFAULT_TESTIMONIALS],
      progress: [],
      ctaClicks: 0,
      realComments: []
    };

    this.loadInitialLocalFile();
  }

  private loadInitialLocalFile() {
    // 1. First load bundled seed defaults if available
    const seedPaths = [
      path.join(process.cwd(), 'data', 'default_settings.json'),
      path.join(process.cwd(), 'data', 'db.json')
    ];
    for (const p of seedPaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          const parsed = JSON.parse(raw);
          this.mergeData(parsed);
        }
      } catch (_) {}
    }

    // 2. Then overlay dynamic runtime database from /tmp if present (local mode only)
    if (isSupabaseEnabled) return;
    const tmpPath = path.join('/tmp', 'webinar_db.json');
    try {
      if (fs.existsSync(tmpPath)) {
        const raw = fs.readFileSync(tmpPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.mergeData(parsed);
      }
    } catch (_) {}
  }

  /** Reload everything from Supabase (cached for a few seconds per server instance). */
  async ensureFresh(force = false): Promise<void> {
    if (!this.remote) return;
    if (!force && Date.now() - this.lastSync < SYNC_TTL_MS) return;
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      try {
        const [config, users, progress, questions, realComments, presence] = await Promise.all([
          store.loadConfig(),
          store.loadRows<User>('wb_users'),
          store.loadRows<UserProgress>('wb_progress'),
          store.loadRows<UserQuestion>('wb_questions'),
          store.loadRows<SyncComment>('wb_real_comments'),
          store.loadRows<{ email: string; name: string; timestamp: number; device?: string; ip?: string }>('wb_presence'),
        ]);
        if (config.settings) this.data.settings = { ...DEFAULT_SETTINGS, ...config.settings };
        if (Array.isArray(config.comments)) this.data.comments = config.comments;
        if (Array.isArray(config.materials)) this.data.materials = config.materials;
        if (Array.isArray(config.bonuses)) this.data.bonuses = config.bonuses;
        if (Array.isArray(config.faq)) this.data.faq = config.faq;
        if (Array.isArray(config.testimonials)) this.data.testimonials = config.testimonials;
        if (typeof config.ctaClicks === 'number') this.data.ctaClicks = config.ctaClicks;
        if (typeof config.peakUsers === 'number') this.data.peakUsers = config.peakUsers;
        if (config.visits && typeof config.visits === 'object') this.data.visits = config.visits;
        if (Array.isArray(config.webinars)) this.data.webinars = config.webinars;
        this.data.users = users;
        this.data.progress = progress;
        this.data.questions = questions.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        this.data.realComments = realComments.sort((a, b) => (a.time || 0) - (b.time || 0));
        const active: NonNullable<DatabaseSchema['activeUsers']> = {};
        for (const p of presence) {
          if (p && p.email && (p as any).kind !== 'agent') active[keyOf(p.email)] = { name: p.name, timestamp: p.timestamp, device: p.device, ip: p.ip, webinarId: (p as any).webinarId };
        }
        this.data.activeUsers = active;
        this.lastSync = Date.now();
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  /** Re-read one participant's rows straight from the database before changing them. */
  private async refreshParticipant(email: string) {
    if (!this.remote || !email) return;
    const id = keyOf(email);
    const [u, p] = await Promise.all([store.getRow<User>('wb_users', id), store.getRow<UserProgress>('wb_progress', id)]);
    this.data.users = this.data.users.filter(x => keyOf(x.email) !== id);
    if (u) this.data.users.push(u);
    this.data.progress = this.data.progress.filter(x => keyOf(x.email) !== id);
    if (p) this.data.progress.push(p);
  }

  private async saveUser(u?: User) {
    if (!u) return;
    if (this.remote) await store.upsertRow('wb_users', keyOf(u.email), u);
    else this.saveLocalSafe();
  }

  private async saveProgressRow(p?: UserProgress) {
    if (!p) return;
    if (this.remote) await store.upsertRow('wb_progress', keyOf(p.email), p);
    else this.saveLocalSafe();
  }

  private async saveConfigKey(key: 'settings' | 'comments' | 'materials' | 'bonuses' | 'faq' | 'testimonials' | 'ctaClicks' | 'peakUsers' | 'visits' | 'webinars') {
    if (this.remote) await store.saveConfig(key, (this.data as any)[key]);
    else this.saveLocalSafe();
  }

  /** Count one landing-page visit for today (America/Sao_Paulo calendar day). */
  async trackVisit(): Promise<void> {
    const day = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    if (this.remote) {
      const config = await store.loadConfig();
      this.data.visits = (config.visits && typeof config.visits === 'object') ? config.visits : {};
    }
    if (!this.data.visits) this.data.visits = {};
    this.data.visits[day] = (this.data.visits[day] || 0) + 1;
    await this.saveConfigKey('visits');
  }

  getVisits(): Record<string, number> {
    return this.data.visits || {};
  }

  // ===================== Webinars =====================
  getWebinars(): Webinar[] {
    return this.data.webinars || [];
  }

  async saveWebinars(list: Webinar[]): Promise<Webinar[]> {
    this.data.webinars = list;
    await this.saveConfigKey('webinars');
    return list;
  }

  // ===================== Atendimento (tickets) =====================
  getTickets(webinarId?: string): SupportTicket[] {
    const all = (this.data.questions as any[]).filter((q) => q && q.kind === 'ticket') as SupportTicket[];
    return webinarId ? all.filter((t) => t.webinarId === webinarId) : all;
  }

  private putTicketInMemory(t: SupportTicket) {
    const idx = (this.data.questions as any[]).findIndex((q) => q.id === t.id);
    if (idx >= 0) (this.data.questions as any[])[idx] = t;
    else (this.data.questions as any[]).push(t);
  }

  /** Re-read a ticket straight from the database (avoids losing messages written by another server instance). */
  async loadTicket(id: string): Promise<SupportTicket | null> {
    if (this.remote) {
      const t = await store.getRow<SupportTicket>('wb_questions', id);
      if (t) this.putTicketInMemory(t);
      return t;
    }
    return this.getTickets().find((t) => t.id === id) || null;
  }

  async saveTicket(t: SupportTicket): Promise<SupportTicket> {
    t.updatedAt = new Date().toISOString();
    this.putTicketInMemory(t);
    if (this.remote) await store.upsertRow('wb_questions', t.id, t);
    else this.saveLocalSafe();
    return t;
  }

  /** Lead sends a message: appends to the open ticket for this webinar or opens a new one. */
  async leadMessage(webinarId: string, email: string, name: string, text: string): Promise<SupportTicket> {
    const lead = keyOf(email);
    const msg: SupportMessage = { id: 'm_' + Math.random().toString(36).slice(2, 10), from: 'lead', name, text, at: new Date().toISOString() };
    const existing = this.getTickets(webinarId)
      .filter((t) => keyOf(t.leadEmail) === lead && t.status !== 'closed')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (existing) {
      const fresh = (await this.loadTicket(existing.id)) || existing;
      if (fresh.status !== 'closed') {
        fresh.messages = [...(fresh.messages || []), msg];
        fresh.unreadForAgent = (fresh.unreadForAgent || 0) + 1;
        return this.saveTicket(fresh);
      }
    }
    const now = new Date().toISOString();
    const t: SupportTicket = {
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind: 'ticket',
      webinarId,
      leadEmail: email,
      leadName: name,
      status: 'open',
      messages: [msg],
      unreadForAgent: 1,
      createdAt: now,
      updatedAt: now,
    };
    return this.saveTicket(t);
  }

  async agentMessage(id: string, agentEmail: string, text: string): Promise<SupportTicket | null> {
    const t = await this.loadTicket(id);
    if (!t) return null;
    const agentName = agentEmail.split('@')[0];
    t.messages = [...(t.messages || []), { id: 'm_' + Math.random().toString(36).slice(2, 10), from: 'agent', name: agentName, text, at: new Date().toISOString() }];
    if (t.status === 'open') { t.status = 'assigned'; t.assignedTo = agentEmail; }
    t.unreadForAgent = 0;
    return this.saveTicket(t);
  }

  async updateTicketStatus(id: string, agentEmail: string, action: 'assign' | 'dismiss' | 'close' | 'read'): Promise<SupportTicket | null> {
    const t = await this.loadTicket(id);
    if (!t) return null;
    if (action === 'assign') { t.status = 'assigned'; t.assignedTo = agentEmail; t.unreadForAgent = 0; }
    if (action === 'dismiss') { t.status = 'closed'; t.dismissed = true; t.closedBy = agentEmail; }
    if (action === 'close') { t.status = 'closed'; t.closedBy = agentEmail; if (!t.assignedTo) t.assignedTo = agentEmail; }
    if (action === 'read') { t.unreadForAgent = 0; }
    return this.saveTicket(t);
  }

  // ===================== Presença por sala =====================
  private localAgents: Record<string, number> = {};

  async agentPing(webinarId: string, email: string) {
    const id = `agent:${webinarId}:${keyOf(email)}`;
    if (this.remote) await store.upsertRow('wb_presence', id, { kind: 'agent', webinarId, email: keyOf(email), timestamp: Date.now() });
    else this.localAgents[id] = Date.now();
  }

  /** Viewers and agents online per webinar right now. */
  async roomCounts(): Promise<Record<string, { viewers: number; agents: number }>> {
    const out: Record<string, { viewers: number; agents: number }> = {};
    const bump = (w: string, k: 'viewers' | 'agents') => {
      out[w] = out[w] || { viewers: 0, agents: 0 };
      out[w][k]++;
    };
    if (this.remote) {
      const rows = await store.listRecentPresence(PRESENCE_WINDOW_MS);
      for (const r of rows) {
        const d = r.data || {};
        if (d.kind === 'agent') bump(d.webinarId || 'principal', 'agents');
        else bump(d.webinarId || 'principal', 'viewers');
      }
      return out;
    }
    const now = Date.now();
    for (const v of Object.values(this.data.activeUsers || {}) as any[]) {
      if (now - v.timestamp <= PRESENCE_WINDOW_MS) bump(v.webinarId || 'principal', 'viewers');
    }
    for (const [id, ts] of Object.entries(this.localAgents)) {
      if (now - ts <= PRESENCE_WINDOW_MS) bump(id.split(':')[1], 'agents');
    }
    return out;
  }

  storageLabel(): string {
    return this.remote ? 'Supabase (Postgres)' : 'Arquivo local (JSON)';
  }

  private saveLocalSafe() {
    if (this.remote) return;
    const targets = [
      path.join('/tmp', 'webinar_db.json'),
      path.join(process.cwd(), 'data', 'db.json')
    ];

    for (const targetPath of targets) {
      try {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, JSON.stringify(this.data, null, 2), 'utf8');
      } catch (_) {
        // Suppress write errors on read-only environments
      }
    }
  }

  async saveAsDefault(): Promise<boolean> {
    if (this.remote) {
      for (const k of ['settings', 'comments', 'materials', 'bonuses', 'faq', 'testimonials'] as const) {
        await this.saveConfigKey(k);
      }
      return true;
    }
    const defaultPath = path.join(process.cwd(), 'data', 'default_settings.json');
    try {
      const dir = path.dirname(defaultPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(defaultPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (_) {}
    this.saveLocalSafe();
    return true;
  }

  private mergeData(parsed: any) {
    if (!parsed) return;
    if (parsed.settings) this.data.settings = { ...this.data.settings, ...parsed.settings };
    
    if (parsed.visits && typeof parsed.visits === 'object') this.data.visits = parsed.visits;
    if (Array.isArray(parsed.webinars)) this.data.webinars = parsed.webinars;
    if (typeof parsed.ctaClicks === 'number') {
      this.data.ctaClicks = Math.max(this.data.ctaClicks || 0, parsed.ctaClicks);
    }

    if (Array.isArray(parsed.users) && parsed.users.length > 0) {
      if (!this.data.users) this.data.users = [];
      const map = new Map<string, User>();
      this.data.users.forEach(u => {
        const key = (u.email || u.id || '').trim().toLowerCase();
        if (key) map.set(key, u);
      });
      for (const u of parsed.users) {
        const key = (u.email || u.id || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          map.set(key, {
            ...existing,
            ...u,
            clickedCta: existing.clickedCta || u.clickedCta,
            ctaClickTime: existing.ctaClickTime || u.ctaClickTime,
            watchedSeconds: Math.max(existing.watchedSeconds || 0, u.watchedSeconds || 0),
            durationSeconds: Math.max(existing.durationSeconds || 0, u.durationSeconds || 0)
          });
        } else {
          map.set(key, u);
        }
      }
      this.data.users = Array.from(map.values());
    }

    if (Array.isArray(parsed.progress) && parsed.progress.length > 0) {
      if (!this.data.progress) this.data.progress = [];
      const map = new Map<string, UserProgress>();
      this.data.progress.forEach(p => {
        const key = (p.email || p.userId || p.id || '').trim().toLowerCase();
        if (key) map.set(key, p);
      });
      for (const p of parsed.progress) {
        const key = (p.email || p.userId || p.id || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          map.set(key, {
            ...existing,
            ...p,
            clickedCta: existing.clickedCta || p.clickedCta,
            ctaClickTime: existing.ctaClickTime || p.ctaClickTime,
            watchedSeconds: Math.max(existing.watchedSeconds || 0, p.watchedSeconds || 0),
            durationSeconds: Math.max(existing.durationSeconds || 0, p.durationSeconds || 0),
            completed: existing.completed || p.completed
          });
        } else {
          map.set(key, p);
        }
      }
      this.data.progress = Array.from(map.values());
    }

    if (Array.isArray(parsed.comments) && parsed.comments.length > 0) this.data.comments = parsed.comments;
    if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      if (!this.data.questions) this.data.questions = [];
      const map = new Map<string, UserQuestion>(this.data.questions.map(q => [q.id, q]));
      for (const q of parsed.questions) {
        map.set(q.id, q);
      }
      this.data.questions = Array.from(map.values());
    }
    if (Array.isArray(parsed.materials)) this.data.materials = parsed.materials;
    if (Array.isArray(parsed.bonuses)) this.data.bonuses = parsed.bonuses;
    if (Array.isArray(parsed.faq)) this.data.faq = parsed.faq;
    if (Array.isArray(parsed.testimonials)) this.data.testimonials = parsed.testimonials;

    if (Array.isArray(parsed.realComments) && parsed.realComments.length > 0) {
      if (!this.data.realComments) this.data.realComments = [];
      const map = new Map<string, SyncComment>(this.data.realComments.map(c => [c.id, c]));
      for (const rc of parsed.realComments) {
        map.set(rc.id, rc);
      }
      this.data.realComments = Array.from(map.values());
    }
    if (parsed.activeUsers && typeof parsed.activeUsers === 'object') {
      this.data.activeUsers = { ...this.data.activeUsers, ...parsed.activeUsers };
    }
  }

  // --- API Methods ---

  async getSettings(): Promise<Settings> {
    if (this.data.settings.isLiveActive === undefined) {
      this.data.settings.isLiveActive = true;
    }
    const settings = { ...this.data.settings };
    if (!settings.webhookUrl && process.env.WEBHOOK_URL) {
      settings.webhookUrl = process.env.WEBHOOK_URL;
      settings.webhookEnabled = true;
    }
    return settings;
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const currentLiveState = this.data.settings.isLiveActive !== false;
    const nextLiveState = settings.isLiveActive !== undefined ? settings.isLiveActive : currentLiveState;
    this.data.settings = { 
      ...this.data.settings, 
      ...settings,
      isLiveActive: nextLiveState 
    };
    await this.saveConfigKey('settings');
    return this.data.settings;
  }

  async getUsers(): Promise<User[]> {
    return this.data.users;
  }

  async createUser(name: string, email: string, device?: string, ip?: string): Promise<User> {
    await this.refreshParticipant(email);
    const existing = this.data.users.find(u => keyOf(u.email) === keyOf(email));
    if (existing) {
      if (name && name.trim()) existing.name = name.trim();
      if (device) existing.device = device;
      if (ip) existing.ip = ip;
      existing.role = 'user';
      await this.saveUser(existing);
      return existing;
    }

    const newUser: User = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      name,
      email,
      role: 'user',
      createdAt: new Date().toISOString(),
      device,
      ip
    };

    this.data.users.push(newUser);
    await this.saveUser(newUser);
    return newUser;
  }

  async getComments(): Promise<SyncComment[]> {
    return this.data.comments;
  }

  async saveComments(comments: SyncComment[]): Promise<SyncComment[]> {
    this.data.comments = comments;
    await this.saveConfigKey('comments');
    return this.data.comments;
  }

  async getQuestions(): Promise<UserQuestion[]> {
    return this.data.questions.filter((q: any) => q.kind !== 'ticket');
  }

  async addQuestion(name: string, email: string, question: string, userId?: string): Promise<UserQuestion> {
    const newQuestion: UserQuestion = {
      id: 'q_' + Math.random().toString(36).substr(2, 9),
      userId,
      name,
      email,
      question,
      answered: false,
      createdAt: new Date().toISOString()
    };

    this.data.questions.push(newQuestion);
    if (this.remote) await store.upsertRow('wb_questions', newQuestion.id, newQuestion); else this.saveLocalSafe();
    return newQuestion;
  }

  async answerQuestion(id: string, answer: string): Promise<UserQuestion | null> {
    const q = this.data.questions.find(item => item.id === id);
    if (q) {
      q.answered = true;
      q.answer = answer;
      if (this.remote) await store.upsertRow('wb_questions', q.id, q); else this.saveLocalSafe();
      return q;
    }
    return null;
  }

  async deleteQuestion(id: string): Promise<boolean> {
    const index = this.data.questions.findIndex(item => item.id === id);
    if (index !== -1) {
      this.data.questions.splice(index, 1);
      if (this.remote) await store.deleteRow('wb_questions', id); else this.saveLocalSafe();
      return true;
    }
    return false;
  }

  async getMaterials(): Promise<Material[]> {
    return this.data.materials;
  }

  async saveMaterials(materials: Material[]): Promise<Material[]> {
    this.data.materials = materials;
    await this.saveConfigKey('materials');
    return this.data.materials;
  }

  async getBonuses(): Promise<Bonus[]> {
    return this.data.bonuses;
  }

  async saveBonuses(bonuses: Bonus[]): Promise<Bonus[]> {
    this.data.bonuses = bonuses;
    await this.saveConfigKey('bonuses');
    return this.data.bonuses;
  }

  async getFAQ(): Promise<FAQItem[]> {
    return [...this.data.faq].sort((a, b) => a.order - b.order);
  }

  async saveFAQ(faq: FAQItem[]): Promise<FAQItem[]> {
    this.data.faq = faq;
    await this.saveConfigKey('faq');
    return this.data.faq;
  }

  async getTestimonials(): Promise<Testimonial[]> {
    return this.data.testimonials;
  }

  async saveTestimonials(testimonials: Testimonial[]): Promise<Testimonial[]> {
    this.data.testimonials = testimonials;
    await this.saveConfigKey('testimonials');
    return this.data.testimonials;
  }

  async getProgress(): Promise<UserProgress[]> {
    return this.data.progress;
  }

  async saveProgress(userId: string, email: string, name: string, watchedSeconds: number, durationSeconds: number, device?: string, ip?: string): Promise<UserProgress> {
    await this.refreshParticipant(email);
    const existingIndex = this.data.progress.findIndex(p => p.userId === userId || p.email.toLowerCase() === email.toLowerCase());
    const completed = watchedSeconds > 0 && durationSeconds > 0 && (watchedSeconds / durationSeconds) >= 0.9;
    
    let record: UserProgress;
    if (existingIndex !== -1) {
      record = this.data.progress[existingIndex];
      record.watchedSeconds = Math.max(record.watchedSeconds, watchedSeconds);
      if (durationSeconds > 0) record.durationSeconds = durationSeconds;
      record.completed = record.completed || completed;
      record.lastAccessTime = new Date().toISOString();
      if (device) record.device = device;
      if (ip) record.ip = ip;
    } else {
      record = {
        id: 'p_' + Math.random().toString(36).substr(2, 9),
        userId,
        email,
        name,
        watchedSeconds,
        durationSeconds,
        completed,
        lastAccessTime: new Date().toISOString(),
        device,
        ip
      };
      this.data.progress.push(record);
    }

    // Sync on user record as well
    const userRec = this.data.users.find(u => u.id === userId || u.email.toLowerCase() === email.toLowerCase());
    if (userRec) {
      userRec.watchedSeconds = Math.max(userRec.watchedSeconds || 0, watchedSeconds);
      if (durationSeconds > 0) userRec.durationSeconds = durationSeconds;
      if (device) userRec.device = device;
      if (ip) userRec.ip = ip;
    }

    await this.saveProgressRow(record);
    await this.saveUser(userRec);
    return record;
  }

  async incrementCtaClicks(userId?: string, email?: string): Promise<number> {
    if (email) await this.refreshParticipant(email);
    this.data.ctaClicks++;
    const now = new Date().toISOString();

    const cleanUserId = userId ? userId.trim() : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (cleanUserId || cleanEmail) {
      const userRec = this.data.users.find(u => 
        (cleanUserId && u.id === cleanUserId) || 
        (cleanEmail && cleanEmail.length > 0 && u.email.toLowerCase() === cleanEmail)
      );
      if (userRec) {
        userRec.clickedCta = true;
        userRec.ctaClickTime = now;
      }
      const progRec = this.data.progress.find(p => 
        (cleanUserId && p.userId === cleanUserId) || 
        (cleanEmail && cleanEmail.length > 0 && p.email.toLowerCase() === cleanEmail)
      );
      if (progRec) {
        progRec.clickedCta = true;
        progRec.ctaClickTime = now;
      }
      await this.saveUser(userRec);
      await this.saveProgressRow(progRec);
    }

    await this.saveConfigKey('ctaClicks');
    return this.data.ctaClicks;
  }

  async toggleLeadCta(id?: string, email?: string, forceStatus?: boolean): Promise<boolean> {
    const cleanId = id ? id.trim() : '';
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    if (!cleanId && !cleanEmail) return false;

    if (cleanEmail) await this.refreshParticipant(cleanEmail);
    let updated = false;
    const touchedUsers: User[] = [];
    const touchedProgress: UserProgress[] = [];
    for (const u of this.data.users) {
      if ((cleanId && u.id === cleanId) || (cleanEmail && cleanEmail.length > 0 && u.email.toLowerCase() === cleanEmail)) {
        u.clickedCta = forceStatus !== undefined ? forceStatus : !u.clickedCta;
        if (u.clickedCta) {
          u.ctaClickTime = new Date().toISOString();
        } else {
          delete u.ctaClickTime;
        }
        touchedUsers.push(u);
        updated = true;
      }
    }

    for (const p of this.data.progress) {
      if ((cleanId && p.userId === cleanId) || (cleanEmail && cleanEmail.length > 0 && p.email.toLowerCase() === cleanEmail)) {
        p.clickedCta = forceStatus !== undefined ? forceStatus : !p.clickedCta;
        if (p.clickedCta) {
          p.ctaClickTime = new Date().toISOString();
        } else {
          delete p.ctaClickTime;
        }
        touchedProgress.push(p);
        updated = true;
      }
    }

    for (const u of touchedUsers) await this.saveUser(u);
    for (const p of touchedProgress) await this.saveProgressRow(p);
    return updated;
  }

  async pingUser(email: string, name?: string, device?: string, ip?: string, webinarId?: string): Promise<{ onlineNow: number }> {
    if (!this.data.activeUsers) {
      this.data.activeUsers = {};
    }
    if (!email || !email.trim()) {
      return { onlineNow: await this.countOnline() };
    }
    const cleanEmail = keyOf(email);
    const cleanName = name ? name.trim() : 'Usuário';
    const entry = {
      webinarId: webinarId || 'principal',
      name: cleanName,
      timestamp: Date.now(),
      device: device || this.data.activeUsers[cleanEmail]?.device,
      ip: ip || this.data.activeUsers[cleanEmail]?.ip
    };
    this.data.activeUsers[cleanEmail] = entry;

    // Auto-register the participant if it does not exist yet (never overwrites existing data)
    const newUser: User = {
      id: 'u_' + Math.random().toString(36).substr(2, 9),
      name: cleanName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
      role: 'user',
      device,
      ip
    };

    if (this.remote) {
      await store.upsertRow('wb_presence', cleanEmail, { email: cleanEmail, ...entry });
      await store.insertIfMissing('wb_users', cleanEmail, newUser);
      return { onlineNow: await this.countOnline() };
    }

    const exists = this.data.users.find(u => keyOf(u.email) === cleanEmail);
    if (!exists) {
      this.data.users.push(newUser);
    } else {
      if (name && cleanName && exists.name !== cleanName) exists.name = cleanName;
      if (device) exists.device = device;
      if (ip) exists.ip = ip;
    }

    const now = Date.now();
    for (const [key, val] of Object.entries(this.data.activeUsers)) {
      if (now - val.timestamp > PRESENCE_WINDOW_MS) delete this.data.activeUsers[key];
    }

    this.saveLocalSafe();
    return { onlineNow: this.getActiveUsersCount() };
  }

  async disconnectUser(email: string): Promise<{ onlineNow: number }> {
    if (email) {
      const cleanEmail = keyOf(email);
      if (this.data.activeUsers) delete this.data.activeUsers[cleanEmail];
      if (this.remote) await store.deleteRow('wb_presence', cleanEmail);
      else this.saveLocalSafe();
    }
    return { onlineNow: await this.countOnline() };
  }

  async countOnline(): Promise<number> {
    if (this.remote) {
      try { return await store.countRecentPresence(PRESENCE_WINDOW_MS); } catch { /* fall back to cache */ }
    }
    return this.getActiveUsersCount();
  }

  getActiveUsersCount(): number {
    if (!this.data.activeUsers) return 0;
    const now = Date.now();
    let count = 0;
    for (const [_, val] of Object.entries(this.data.activeUsers)) {
      if (now - val.timestamp <= 25000) {
        count++;
      }
    }
    return count;
  }

  async getLeads(): Promise<LeadInfo[]> {
    const users = this.data.users;
    const progressMap = new Map<string, UserProgress>();
    for (const p of this.data.progress) {
      if (p.email) progressMap.set(p.email.toLowerCase(), p);
      if (p.userId) progressMap.set(p.userId, p);
    }

    const activeObj = this.data.activeUsers || {};
    const now = Date.now();
    const leadsMap = new Map<string, LeadInfo>();

    for (const u of users) {
      const emailKey = u.email.toLowerCase();
      const prog = progressMap.get(u.id) || progressMap.get(emailKey);
      const watchedSeconds = Math.max(u.watchedSeconds || 0, prog ? prog.watchedSeconds : 0);
      const durationSeconds = prog ? prog.durationSeconds : (u.durationSeconds || 0);
      const completed = prog ? prog.completed : (watchedSeconds > 0 && durationSeconds > 0 ? (watchedSeconds / durationSeconds) >= 0.9 : false);
      const clickedCta = !!u.clickedCta || (prog ? !!prog.clickedCta : false);
      const ctaClickTime = u.ctaClickTime || (prog ? prog.ctaClickTime : undefined);
      const isOnline = activeObj[emailKey] ? (now - activeObj[emailKey].timestamp <= 25000) : false;
      const device = activeObj[emailKey]?.device || u.device || prog?.device || 'Desktop';
      const ip = activeObj[emailKey]?.ip || u.ip || prog?.ip || '---';

      leadsMap.set(emailKey, {
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        watchedSeconds,
        durationSeconds,
        completed,
        clickedCta,
        ctaClickTime,
        lastAccessTime: prog ? prog.lastAccessTime : u.createdAt,
        isOnline,
        device,
        ip
      });
    }

    // Include progress entries if user not in main users array
    for (const p of this.data.progress) {
      const emailKey = p.email.toLowerCase();
      if (!leadsMap.has(emailKey)) {
        const isOnline = activeObj[emailKey] ? (now - activeObj[emailKey].timestamp <= 25000) : false;
        const device = activeObj[emailKey]?.device || p.device || 'Desktop';
        const ip = activeObj[emailKey]?.ip || p.ip || '---';
        leadsMap.set(emailKey, {
          id: p.userId || p.id || ('u_' + emailKey.replace(/[^a-z0-9]/g, '_')),
          name: p.name,
          email: p.email,
          createdAt: p.lastAccessTime || new Date().toISOString(),
          watchedSeconds: p.watchedSeconds,
          durationSeconds: p.durationSeconds,
          completed: p.completed,
          clickedCta: !!p.clickedCta,
          ctaClickTime: p.ctaClickTime,
          lastAccessTime: p.lastAccessTime,
          isOnline,
          device,
          ip
        });
      }
    }

    const list = Array.from(leadsMap.values());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async deleteLead(idOrEmail: string, email?: string): Promise<boolean> {
    if (!idOrEmail && !email) return false;
    const targetId = idOrEmail ? decodeURIComponent(idOrEmail).trim().toLowerCase() : '';
    const targetEmail = email ? email.trim().toLowerCase() : targetId;

    const removedUsers: string[] = [];
    const removedProgress: string[] = [];
    this.data.users = this.data.users.filter(u => {
      const keep = (() => {
      const uId = u.id ? u.id.trim().toLowerCase() : '';
      const uEmail = u.email ? u.email.trim().toLowerCase() : '';
      if (targetId && uId === targetId) return false;
      if (targetEmail && uEmail === targetEmail) return false;
      if (targetId && uEmail && targetId === uEmail) return false;
      return true;
      })();
      if (!keep) removedUsers.push(keyOf(u.email));
      return keep;
    });

    this.data.progress = this.data.progress.filter(p => {
      const keep = (() => {
      const pUserId = p.userId ? p.userId.trim().toLowerCase() : '';
      const pId = p.id ? p.id.trim().toLowerCase() : '';
      const pEmail = p.email ? p.email.trim().toLowerCase() : '';
      if (targetId && (pUserId === targetId || pId === targetId)) return false;
      if (targetEmail && pEmail === targetEmail) return false;
      if (targetId && pEmail && targetId === pEmail) return false;
      return true;
      })();
      if (!keep) removedProgress.push(keyOf(p.email));
      return keep;
    });

    if (this.remote) {
      for (const id of new Set(removedUsers)) await store.deleteRow('wb_users', id);
      for (const id of new Set(removedProgress)) await store.deleteRow('wb_progress', id);
      if (targetEmail) {
        await store.deleteRow('wb_users', targetEmail);
        await store.deleteRow('wb_progress', targetEmail);
        await store.deleteRow('wb_presence', targetEmail);
      }
    } else {
      this.saveLocalSafe();
    }
    return true;
  }

  async getCtaClicks(): Promise<number> {
    const leads = await this.getLeads();
    const leadClicks = leads.filter(l => l.clickedCta).length;
    this.data.ctaClicks = leadClicks;
    return this.data.ctaClicks;
  }

  async getRealComments(): Promise<SyncComment[]> {
    if (!this.data.realComments) this.data.realComments = [];
    return this.data.realComments;
  }

  async addRealComment(name: string, message: string, time: number, photoUrl?: string): Promise<SyncComment> {
    if (!this.data.realComments) this.data.realComments = [];
    const newComment: SyncComment = {
      id: 'rc_' + Math.random().toString(36).substr(2, 9),
      name,
      message,
      time,
      photoUrl: photoUrl || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`
    };
    this.data.realComments.push(newComment);
    if (this.remote) await store.upsertRow('wb_real_comments', newComment.id, newComment); else this.saveLocalSafe();
    return newComment;
  }

  async deleteRealComment(id: string): Promise<boolean> {
    if (!this.data.realComments) this.data.realComments = [];
    const initialLength = this.data.realComments.length;
    this.data.realComments = this.data.realComments.filter(c => c.id !== id);
    if (this.remote) await store.deleteRow('wb_real_comments', id); else this.saveLocalSafe();
    return this.data.realComments.length < initialLength;
  }

  async clearRealComments(): Promise<void> {
    this.data.realComments = [];
    if (this.remote) await store.clearTable('wb_real_comments'); else this.saveLocalSafe();
  }

  getPeakUsers(): number {
    return this.data.peakUsers || 0;
  }

  async getLiveMapData(): Promise<LiveAnalyticsMapData> {
    const now = Date.now();
    const realActiveUsers = this.data.activeUsers || {};
    const viewers: GeoViewer[] = [];

    let desktopCount = 0;
    let mobileCount = 0;
    let tabletCount = 0;

    // 1. Process STRICTLY Real Online Users (currently pinging within 25 seconds)
    for (const [emailKey, info] of Object.entries(realActiveUsers)) {
      if (now - info.timestamp <= 25000) {
        const geo = await resolveIp(info.ip, emailKey);
        const rawDevice = (info.device || '').toLowerCase();
        let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
        if (rawDevice.includes('mobile') || rawDevice.includes('iphone') || rawDevice.includes('android')) {
          deviceType = 'mobile';
        } else if (rawDevice.includes('tablet') || rawDevice.includes('ipad')) {
          deviceType = 'tablet';
        }

        if (deviceType === 'desktop') desktopCount++;
        else if (deviceType === 'mobile') mobileCount++;
        else tabletCount++;

        // find progress if any
        const prog = this.data.progress.find(p => p.email?.toLowerCase() === emailKey);

        viewers.push({
          id: 'real_' + emailKey.replace(/[^a-z0-9]/g, '_'),
          name: info.name || 'Participante Ao Vivo',
          email: emailKey,
          city: geo.city,
          state: geo.region,
          country: geo.country,
          lat: geo.lat,
          lng: geo.lng,
          device: deviceType,
          isOnline: true,
          isReal: true,
          lastPing: info.timestamp,
          watchedSeconds: prog?.watchedSeconds,
          clickedCta: prog?.clickedCta
        });
      }
    }

    // If no real-time pinging viewers are detected at this exact 25s window, map recent registered participants
    if (viewers.length === 0 && this.data.users && this.data.users.length > 0) {
      const recentUsers = this.data.users.slice(0, 25);
      for (const u of recentUsers) {
        const geo = await resolveIp(u.ip, u.email || u.id);
        const rawDevice = (u.device || '').toLowerCase();
        let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
        if (rawDevice.includes('mobile') || rawDevice.includes('iphone') || rawDevice.includes('android')) {
          deviceType = 'mobile';
        } else if (rawDevice.includes('tablet') || rawDevice.includes('ipad')) {
          deviceType = 'tablet';
        }

        if (deviceType === 'desktop') desktopCount++;
        else if (deviceType === 'mobile') mobileCount++;
        else tabletCount++;

        const prog = this.data.progress.find(p => p.email?.toLowerCase() === u.email?.toLowerCase());

        viewers.push({
          id: 'lead_' + (u.id || u.email).replace(/[^a-z0-9]/g, '_'),
          name: u.name || 'Participante',
          email: u.email,
          city: geo.city,
          state: geo.region,
          country: geo.country,
          lat: geo.lat,
          lng: geo.lng,
          device: deviceType,
          isOnline: false,
          isReal: true,
          lastPing: new Date(u.createdAt).getTime(),
          watchedSeconds: prog?.watchedSeconds || u.watchedSeconds,
          clickedCta: prog?.clickedCta || u.clickedCta
        });
      }
    }

    const totalActive = viewers.length;
    
    // Track Peak based on actual real viewers
    if (totalActive > (this.data.peakUsers || 0)) {
      this.data.peakUsers = totalActive;
      await this.saveConfigKey('peakUsers');
    }

    const totalDevices = desktopCount + mobileCount + tabletCount;
    const devices: DeviceBreakdown = {
      desktop: desktopCount,
      mobile: mobileCount,
      tablet: tabletCount,
      desktopPct: totalDevices > 0 ? Math.round((desktopCount / totalDevices) * 100) : 0,
      mobilePct: totalDevices > 0 ? Math.round((mobileCount / totalDevices) * 100) : 0,
      tabletPct: totalDevices > 0 ? Math.round((tabletCount / totalDevices) * 100) : 0
    };

    // Calculate unique real locations
    const uniqueLocations = new Set(viewers.map(v => `${v.city}_${v.state}`));

    return {
      totalActive,
      peakActive: this.data.peakUsers || totalActive,
      devices,
      locationsCount: uniqueLocations.size,
      viewers,
      timestamp: new Date().toISOString()
    };
  }
}

export const db = new Database();

