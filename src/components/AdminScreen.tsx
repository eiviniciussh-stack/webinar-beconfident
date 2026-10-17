import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, Settings, ShieldAlert, Users, MessageSquareCode, 
  HelpCircle, Gift, FileDown, Eye, Save, Plus, Trash2, 
  ArrowLeft, CheckCircle2, RefreshCw, Star, ArrowUpRight, Check, CheckSquare, Calendar,
  Activity, AlertTriangle, Terminal, XCircle, Info, Database,
  UserCheck, Clock, MousePointerClick, Search, Download, TrendingUp, UserPlus, ExternalLink, Filter,
  Radio, Send, MessageSquare, Phone, Smartphone, Laptop, Tablet, Globe, MapPin, Zap, LogOut, ShieldCheck, LayoutDashboard, Video, UserCog, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useToast } from './Toast';
import { BeConfidentMark } from './BrandHeader';
import AdminUsersPanel from './AdminUsersPanel';
import DashboardPanel from './DashboardPanel';
import * as adminAuth from '../adminAuth';
import { 
  Settings as AppSettings, SyncComment, FAQItem, Bonus, 
  Testimonial, Material, UserQuestion, UserProgress, WebinarStats, User, LeadInfo
} from '../types';
import { LiveMonitoringMap } from './LiveMonitoringMap';

interface AdminScreenProps {
  onBack: () => void;
  onSettingsUpdated: (settings: AppSettings) => void;
  initialSettings: AppSettings;
  user?: User | null;
}

function formatSecondsToMMSS(sec: number): string {
  if (!sec || isNaN(sec) || sec <= 0) return '0s';
  const mins = Math.floor(sec / 60);
  const secs = Math.floor(sec % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getDeviceIcon(device?: string) {
  if (!device) return <Laptop className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('iphone') || d.includes('android')) {
    return <Smartphone className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  }
  if (d.includes('tablet') || d.includes('ipad')) {
    return <Tablet className="h-3.5 w-3.5 text-purple-400 shrink-0" />;
  }
  return <Laptop className="h-3.5 w-3.5 text-sky-400 shrink-0" />;
}

// Unified API fetch helper with rich diagnostic error messages
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await adminAuth.adminFetch(url, options);
  } catch (netErr: any) {
    const isTypeError = netErr.name === 'TypeError' || (netErr.message && netErr.message.toLowerCase().includes('fetch'));
    const msg = isTypeError 
      ? `Falha de Conexão com o Servidor (Rede/CORS): Não foi possível conectar a '${url}'. Verifique se o servidor está online e permitindo requisições.`
      : `Erro de Rede (${netErr.name}): ${netErr.message}`;
    throw new Error(msg);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    let errorDetail = '';
    if (isJson) {
      try {
        const errJson = await res.json();
        errorDetail = errJson.error || errJson.message || JSON.stringify(errJson);
      } catch (_) {}
    }
    
    if (!errorDetail) {
      try {
        const rawText = await res.text();
        if (rawText) {
          const cleanText = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
          errorDetail = cleanText.length > 250 ? `${cleanText.slice(0, 250)}...` : cleanText;
        }
      } catch (_) {}
    }

    if (!errorDetail) {
      errorDetail = res.statusText || 'Erro sem mensagem detalhada do servidor';
    }

    throw new Error(`[HTTP ${res.status} ${res.statusText}] ${errorDetail}`);
  }

  if (!isJson) {
    const rawText = await res.text();
    const snippet = rawText.slice(0, 150).replace(/<[^>]*>?/gm, ' ');
    throw new Error(`Servidor respondeu com sucesso [HTTP ${res.status}], mas o retorno não é JSON válido. Conteúdo: ${snippet}`);
  }

  return await res.json();
}

export default function AdminScreen({ onBack, onSettingsUpdated, initialSettings, user }: AdminScreenProps) {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!adminAuth.getSession());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'webinar' | 'questions' | 'users' | 'content' | 'admins'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dbStatus, setDbStatus] = useState<{ status: string; storage: string } | null>(null);

  // Diagnostic panel states
  const [diagnosticError, setDiagnosticError] = useState<{ endpoint: string; method: string; message: string; timestamp: string } | null>(null);
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<Array<{ step: string; status: 'pending' | 'success' | 'error'; details: string; latencyMs?: number }> | null>(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);

  // States for DB entity managers
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [stats, setStats] = useState<WebinarStats>({
    totalUsers: 0,
    activeUsers: 0,
    avgWatchTime: 0,
    questionsCount: 0,
    ctaClicks: 0
  });
  const [questions, setQuestions] = useState<UserQuestion[]>([]);
  const [userProgressList, setUserProgressList] = useState<UserProgress[]>([]);
  const [leads, setLeads] = useState<LeadInfo[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadFilterCta, setLeadFilterCta] = useState<'all' | 'clicked' | 'not_clicked'>('all');
  const [comments, setComments] = useState<SyncComment[]>([]);
  const [faq, setFaq] = useState<FAQItem[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [realComments, setRealComments] = useState<SyncComment[]>([]);

  // Sub-tabs in Content Manager
  const [contentTab, setContentTab] = useState<'comments' | 'materials' | 'faq' | 'bonuses' | 'testimonials' | 'real_comments'>('comments');

  // Sub-tabs in Live Control Room
  const [liveSubTab, setLiveSubTab] = useState<'map' | 'audience' | 'chat' | 'questions'>('map');
  const [adminChatMessage, setAdminChatMessage] = useState('');
  const [adminChatName, setAdminChatName] = useState('Moderador da Live');

  // Inline replies
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isRefreshingLeads, setIsRefreshingLeads] = useState(false);

  const deletedCommentIds = React.useRef<Set<string>>(new Set());
  const deletedQuestionIds = React.useRef<Set<string>>(new Set());

  const toast = useToast();

  useEffect(() => {
    if (isAuthenticated) fetchAllData();
    const onLogout = () => setIsAuthenticated(false);
    window.addEventListener('bc-admin-logout', onLogout);
    return () => window.removeEventListener('bc-admin-logout', onLogout);
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await adminAuth.login(loginEmail.trim(), loginPassword);
      setLoginPassword('');
      setIsAuthenticated(true);
      toast.success('Acesso liberado!', 'Carregando os dados do painel...');
      fetchAllData();
    } catch (err: any) {
      toast.error('Não foi possível entrar', err?.message || 'Verifique e-mail e senha.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    adminAuth.logout();
    setIsAuthenticated(false);
    toast.info('Sessão encerrada', 'Você saiu do painel administrativo.');
  };

  const fetchAllData = async () => {
    try {
      // 0. DB Status
      try {
        const dbStatusRes = await apiFetch<{ status: string; storage: string }>('/api/db-status');
        setDbStatus(dbStatusRes);
      } catch (_) {}

      // 1. Settings
      try {
        const sData = await apiFetch<AppSettings>('/api/settings');
        setSettings(sData);
        onSettingsUpdated(sData);
      } catch (_) {}

      // 2. Stats
      try {
        const s = await apiFetch<WebinarStats>('/api/stats');
        setStats(s);
      } catch (_) {}

      // 3. Questions
      try {
        const q = await apiFetch<UserQuestion[]>('/api/questions');
        if (Array.isArray(q)) {
          setQuestions(prev => {
            const map = new Map<string, UserQuestion>();
            prev.forEach(item => {
              if (!deletedQuestionIds.current.has(item.id)) map.set(item.id, item);
            });
            q.forEach(item => {
              if (!deletedQuestionIds.current.has(item.id)) {
                const existing = map.get(item.id);
                if (existing) {
                  map.set(item.id, { ...existing, ...item });
                } else {
                  map.set(item.id, item);
                }
              }
            });
            return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
        }
      } catch (_) {}

      // 4. User Progress
      try {
        const p = await apiFetch<UserProgress[]>('/api/progress');
        setUserProgressList(p);
      } catch (_) {}

      // 4b. Leads
      try {
        const l = await apiFetch<LeadInfo[]>('/api/leads');
        setLeads(l);
      } catch (_) {}

      // 5. Comments
      try {
        const c = await apiFetch<SyncComment[]>('/api/comments');
        setComments(c);
      } catch (_) {}

      // 5b. Real Comments
      try {
        const rc = await apiFetch<SyncComment[]>('/api/real-comments');
        if (Array.isArray(rc)) {
          setRealComments(prev => {
            const map = new Map<string, SyncComment>();
            prev.forEach(c => {
              if (!deletedCommentIds.current.has(c.id)) map.set(c.id, c);
            });
            rc.forEach(c => {
              if (!deletedCommentIds.current.has(c.id)) map.set(c.id, c);
            });
            return Array.from(map.values()).sort((a, b) => a.time - b.time);
          });
        }
      } catch (_) {}

      // 6. FAQ
      try {
        const f = await apiFetch<FAQItem[]>('/api/faq');
        setFaq(f);
      } catch (_) {}

      // 7. Bonuses
      try {
        const b = await apiFetch<Bonus[]>('/api/bonuses');
        setBonuses(b);
      } catch (_) {}

      // 8. Materials
      try {
        const m = await apiFetch<Material[]>('/api/materials');
        setMaterials(m);
      } catch (_) {}

      // 9. Testimonials
      try {
        const t = await apiFetch<Testimonial[]>('/api/testimonials');
        setTestimonials(t);
      } catch (_) {}

    } catch (err) {
      console.error(err);
      toast.error('Erro de conexão', 'Não foi possível carregar os dados para o painel administrativo.');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
      const interval = setInterval(async () => {
        try {
          const statsRes = await apiFetch<WebinarStats>('/api/stats');
          if (statsRes) {
            setStats(prev => {
              if (prev &&
                  prev.totalUsers === statsRes.totalUsers &&
                  prev.activeUsers === statsRes.activeUsers &&
                  prev.avgWatchTime === statsRes.avgWatchTime &&
                  prev.questionsCount === statsRes.questionsCount &&
                  prev.ctaClicks === statsRes.ctaClicks) {
                return prev;
              }
              return statsRes;
            });
          }
          
          const leadsRes = await apiFetch<LeadInfo[]>('/api/leads');
          if (Array.isArray(leadsRes)) {
            setLeads(prev => {
              const prevKey = prev.map(l => `${l.id}_${l.watchedSeconds}_${l.isOnline}_${l.clickedCta}`).join('|');
              const newKey = leadsRes.map(l => `${l.id}_${l.watchedSeconds}_${l.isOnline}_${l.clickedCta}`).join('|');
              if (prevKey === newKey && prev.length === leadsRes.length) {
                return prev;
              }
              const map = new Map<string, LeadInfo>();
              prev.forEach(l => map.set(l.email.toLowerCase(), l));
              leadsRes.forEach(l => {
                const emailKey = l.email.toLowerCase();
                const existing = map.get(emailKey);
                if (existing) {
                  map.set(emailKey, {
                    ...existing,
                    ...l,
                    clickedCta: l.clickedCta !== undefined ? l.clickedCta : existing.clickedCta,
                    watchedSeconds: Math.max(existing.watchedSeconds || 0, l.watchedSeconds || 0),
                    durationSeconds: Math.max(existing.durationSeconds || 0, l.durationSeconds || 0),
                    isOnline: l.isOnline
                  });
                } else {
                  map.set(emailKey, l);
                }
              });
              return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          }

          const progRes = await apiFetch<UserProgress[]>('/api/progress');
          if (Array.isArray(progRes)) {
            setUserProgressList(prev => {
              if (prev.length === progRes.length && JSON.stringify(prev) === JSON.stringify(progRes)) {
                return prev;
              }
              return progRes;
            });
          }

          const rcRes = await apiFetch<SyncComment[]>('/api/real-comments');
          if (Array.isArray(rcRes)) {
            setRealComments(prev => {
              const activeRc = rcRes.filter(c => !deletedCommentIds.current.has(c.id));
              if (prev.length === activeRc.length && JSON.stringify(prev) === JSON.stringify(activeRc)) {
                return prev;
              }
              const map = new Map<string, SyncComment>();
              prev.forEach(c => {
                if (!deletedCommentIds.current.has(c.id)) map.set(c.id, c);
              });
              rcRes.forEach(c => {
                if (!deletedCommentIds.current.has(c.id)) map.set(c.id, c);
              });
              return Array.from(map.values()).sort((a, b) => a.time - b.time);
            });
          }

          const qRes = await apiFetch<UserQuestion[]>('/api/questions');
          if (Array.isArray(qRes)) {
            setQuestions(prev => {
              const map = new Map<string, UserQuestion>();
              prev.forEach(item => {
                if (!deletedQuestionIds.current.has(item.id)) map.set(item.id, item);
              });
              qRes.forEach(item => {
                if (!deletedQuestionIds.current.has(item.id)) {
                  const existing = map.get(item.id);
                  if (existing) {
                    map.set(item.id, { ...existing, ...item });
                  } else {
                    map.set(item.id, item);
                  }
                }
              });
              return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          }
        } catch (_) {}
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleExportConsolidatedCSV = (titlePrefix = 'audiencia_ao_vivo') => {
    const headers = ["Nome", "WhatsApp/Email", "Tempo Assistido (Minutos)", "Tempo Formatado", "Clicou na Oferta", "Endereço IP", "Dispositivo", "Data Entrada/Cadastro"];
    const rows = leads.map(l => {
      const minutes = (l.watchedSeconds / 60).toFixed(1);
      const formatted = formatSecondsToMMSS(l.watchedSeconds);
      const ip = l.ip || '---';
      const device = l.device || 'Desktop';
      const entryDate = l.createdAt ? new Date(l.createdAt).toLocaleString('pt-BR') : '---';
      return [
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.email || '').replace(/"/g, '""')}"`,
        `"${minutes} min"`,
        `"${formatted}"`,
        `"${l.clickedCta ? 'Sim' : 'Não'}"`,
        `"${ip}"`,
        `"${device}"`,
        `"${entryDate}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${titlePrefix}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download Concluído!', 'Relatório consolidado em minutos exportado com sucesso.');
  };

  const handleDeleteLead = async (id: string, name: string, email?: string) => {
    try {
      await apiFetch('/api/leads/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, email }),
      });
      setLeads(prev => prev.filter(l => l.id !== id && (email ? l.email !== email : true)));
      toast.success('Lead Removido', `O lead ${name} foi excluído do sistema.`);
    } catch (err: any) {
      try {
        await apiFetch(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
        setLeads(prev => prev.filter(l => l.id !== id && (email ? l.email !== email : true)));
        toast.success('Lead Removido', `O lead ${name} foi excluído do sistema.`);
      } catch (err2: any) {
        toast.error('Erro ao excluir', err2?.message || 'Falha ao excluir lead.');
      }
    }
  };

  const handleToggleLeadCta = async (leadId: string, leadEmail: string, currentStatus: boolean) => {
    try {
      const res = await apiFetch<{ success: boolean }>('/api/leads/toggle-cta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, email: leadEmail, clickedCta: !currentStatus })
      });
      if (res && res.success) {
        const newStatus = !currentStatus;
        setLeads(prev => prev.map(l => {
          if (l.id === leadId || (l.email && l.email.toLowerCase() === leadEmail.toLowerCase())) {
            return {
              ...l,
              clickedCta: newStatus,
              ctaClickTime: newStatus ? new Date().toISOString() : undefined
            };
          }
          return l;
        }));
        toast.success(
          newStatus ? 'Marcado como Clicou Oferta!' : 'Desmarcado Clique de Oferta!',
          `Status da oferta atualizado para o lead ${leadEmail}.`
        );
      } else {
        toast.error('Erro ao atualizar', 'Não foi possível alterar o status do lead.');
      }
    } catch (err) {
      toast.error('Erro ao atualizar status', 'Não foi possível alterar o status do lead.');
    }
  };

  const handleDeleteRealComment = async (id: string) => {
    try {
      deletedCommentIds.current.add(id);
      await apiFetch(`/api/real-comments/${id}`, { method: 'DELETE' });
      toast.success('Comentário Removido', 'O comentário foi excluído do chat.');
      setRealComments(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      toast.error('Erro ao excluir', err?.message || 'Falha ao excluir comentário.');
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = !leadSearch || 
      l.name.toLowerCase().includes(leadSearch.toLowerCase()) || 
      l.email.toLowerCase().includes(leadSearch.toLowerCase());
    
    if (leadFilterCta === 'clicked') return matchesSearch && l.clickedCta;
    if (leadFilterCta === 'not_clicked') return matchesSearch && !l.clickedCta;
    return matchesSearch;
  });

  const handleExportCsv = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.error('Sem Leads', 'Não há leads filtrados para exportar.');
      return;
    }
    const headers = ['Nome', 'WhatsApp', 'Data de Entrada', 'Tempo Assistido (s)', 'Tempo Formatado', 'Clicou na Oferta', 'Data do Clique'];
    const rows = filteredLeads.map(l => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.email.replace(/"/g, '""')}"`,
      `"${new Date(l.createdAt).toLocaleString('pt-BR')}"`,
      l.watchedSeconds,
      `"${formatSecondsToMMSS(l.watchedSeconds)}"`,
      l.clickedCta ? 'Sim' : 'Não',
      l.ctaClickTime ? `"${new Date(l.ctaClickTime).toLocaleString('pt-BR')}"` : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leads_webinar_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação Concluída!', `${filteredLeads.length} leads exportados para CSV com sucesso.`);
  };

  // Run full system diagnostic check
  const runDiagnosticCheck = async () => {
    setIsRunningDiagnostic(true);
    const logs: Array<{ step: string; status: 'pending' | 'success' | 'error'; details: string; latencyMs?: number }> = [];

    // Step 1: Check /api/db-status
    const t0 = performance.now();
    try {
      const statusRes = await apiFetch<{ status: string; storage: string }>('/api/db-status');
      const t1 = performance.now();
      logs.push({
        step: '1. Leitura do Status do Banco (/api/db-status)',
        status: 'success',
        details: `Conectado ao servidor! Armazenamento: ${statusRes?.storage || "banco de dados"}.`,
        latencyMs: Math.round(t1 - t0)
      });
    } catch (err: any) {
      logs.push({
        step: '1. Leitura do Status do Banco (/api/db-status)',
        status: 'error',
        details: err.message
      });
    }

    // Step 2: Read /api/settings
    const t2 = performance.now();
    try {
      const settingsData = await apiFetch<AppSettings>('/api/settings');
      const t3 = performance.now();
      logs.push({
        step: '2. Leitura de Configurações (/api/settings)',
        status: 'success',
        details: `Dados lidos do servidor! Título ativo: "${settingsData.title}"`,
        latencyMs: Math.round(t3 - t2)
      });
    } catch (err: any) {
      logs.push({
        step: '2. Leitura de Configurações (/api/settings)',
        status: 'error',
        details: err.message
      });
    }

    // Step 3: Write test to /api/settings
    const t4 = performance.now();
    try {
      const writeResult = await apiFetch<AppSettings>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const t5 = performance.now();
      logs.push({
        step: '3. Teste de Escrita e Salvamento (/api/settings)',
        status: 'success',
        details: `Gravação efetuada com sucesso! O servidor aceitou o payload de configurações e respondeu com sucesso.`,
        latencyMs: Math.round(t5 - t4)
      });
    } catch (err: any) {
      logs.push({
        step: '3. Teste de Escrita e Salvamento (/api/settings)',
        status: 'error',
        details: err.message
      });
    }

    setDiagnosticLogs(logs);
    setIsRunningDiagnostic(false);
  };

  // Toggle Live Broadcast On/Off
  const handleToggleLiveStatus = async () => {
    const currentActive = settings.isLiveActive !== false;
    const nextStatus = !currentActive;
    const updated = { ...settings, isLiveActive: nextStatus };
    setIsSaving(true);
    try {
      const res = await apiFetch<AppSettings>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setSettings(res);
      onSettingsUpdated(res);
      if (nextStatus) {
        toast.success('Transmissão Ligada!', 'A sala de webinar está agora AO VIVO para todos os alunos.');
      } else {
        toast.info('Transmissão Encerrada!', 'A live foi desligada. Os alunos agora visualizam a tela offline e os dados consolidados estão disponíveis.');
      }
    } catch (err: any) {
      toast.error('Erro ao alterar status', err?.message || 'Não foi possível alterar o status da transmissão.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setDiagnosticError(null);
    try {
      const updated = await apiFetch<AppSettings>('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      setSettings(updated);
      onSettingsUpdated(updated);
      toast.success('Configurações Salvas!', 'As alterações do webinar já estão ativas e gravadas como padrão.');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      const errMsg = err.message || 'Erro desconhecido ao salvar configurações';
      setDiagnosticError({
        endpoint: '/api/settings',
        method: 'POST',
        message: errMsg,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao salvar', errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsDefault = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setDiagnosticError(null);
    try {
      await apiFetch('/api/save-defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      onSettingsUpdated(settings);
      toast.success('Padrão Salvo!', 'A configuração atual foi gravada no servidor como o padrão definitivo.');
    } catch (err: any) {
      toast.error('Erro ao salvar padrão', err?.message || 'Falha ao gravar configuração como padrão.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Answer to a Question
  const handleAnswerSubmit = async (questionId: string) => {
    const text = replyText[questionId];
    if (!text || !text.trim()) return;

    setDiagnosticError(null);
    try {
      const answeredQ = await apiFetch<UserQuestion>(`/api/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: text.trim() }),
      });

      setQuestions((prev) => prev.map((q) => (q.id === questionId ? answeredQ : q)));
      setReplyText((prev) => ({ ...prev, [questionId]: '' }));
      toast.success('Resposta enviada!', 'O aluno poderá visualizar a resposta na aba do webinar.');
    } catch (err: any) {
      console.error(err);
      setDiagnosticError({
        endpoint: `/api/questions/${questionId}/answer`,
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao responder', err.message);
    }
  };

  // Delete a student question
  const handleDeleteQuestion = async (id: string) => {
    setDiagnosticError(null);
    try {
      deletedQuestionIds.current.add(id);
      await apiFetch<{ success: boolean }>(`/api/questions/${id}`, { method: 'DELETE' });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success('Pergunta removida!', 'A pergunta foi deletada do banco de dados.');
    } catch (err: any) {
      console.error(err);
      setDiagnosticError({
        endpoint: `/api/questions/${id}`,
        method: 'DELETE',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao deletar', err.message);
    }
  };

  // Refresh Leads & Retention Data manually
  const handleRefreshLeads = async () => {
    setIsRefreshingLeads(true);
    try {
      const [lRes, pRes, statsRes] = await Promise.all([
        apiFetch<LeadInfo[]>('/api/leads'),
        apiFetch<UserProgress[]>('/api/progress'),
        apiFetch<WebinarStats>('/api/stats')
      ]);
      if (Array.isArray(lRes)) setLeads(lRes);
      if (Array.isArray(pRes)) setUserProgressList(pRes);
      if (statsRes) setStats(statsRes);
      toast.success('Leads Atualizados!', 'Dados de visualização, retenção e cliques recarregados com sucesso.');
    } catch (err: any) {
      toast.error('Erro ao atualizar', err?.message || 'Falha ao atualizar dados dos leads.');
    } finally {
      setIsRefreshingLeads(false);
    }
  };

  // DB Collection Save Wrappers
  const handleSaveComments = async (updated: SyncComment[]) => {
    setDiagnosticError(null);
    try {
      const saved = await apiFetch<SyncComment[]>('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setComments(saved);
      toast.success('Comentários atualizados!');
    } catch (err: any) {
      setDiagnosticError({
        endpoint: '/api/comments',
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao salvar comentários', err.message);
    }
  };

  const handleSaveFAQ = async (updated: FAQItem[]) => {
    setDiagnosticError(null);
    try {
      const saved = await apiFetch<FAQItem[]>('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setFaq(saved);
      toast.success('FAQ atualizada com sucesso!');
    } catch (err: any) {
      setDiagnosticError({
        endpoint: '/api/faq',
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao salvar FAQ', err.message);
    }
  };

  const handleSaveBonuses = async (updated: Bonus[]) => {
    setDiagnosticError(null);
    try {
      const saved = await apiFetch<Bonus[]>('/api/bonuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setBonuses(saved);
      toast.success('Bônus atualizados com sucesso!');
    } catch (err: any) {
      setDiagnosticError({
        endpoint: '/api/bonuses',
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao salvar bônus', err.message);
    }
  };

  const handleSaveMaterials = async (updated: Material[]) => {
    setDiagnosticError(null);
    try {
      const saved = await apiFetch<Material[]>('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setMaterials(saved);
      toast.success('Materiais atualizados!');
    } catch (err: any) {
      setDiagnosticError({
        endpoint: '/api/materials',
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao salvar materiais', err.message);
    }
  };

  const handleSaveTestimonials = async (updated: Testimonial[]) => {
    setDiagnosticError(null);
    try {
      const saved = await apiFetch<Testimonial[]>('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setTestimonials(saved);
      toast.success('Depoimentos atualizados!');
    } catch (err: any) {
      setDiagnosticError({
        endpoint: '/api/testimonials',
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro ao salvar depoimentos', err.message);
    }
  };

  const handleTestWebhook = async () => {
    if (!settings.webhookUrl || !settings.webhookUrl.trim()) {
      toast.error('URL em branco', 'Por favor, insira uma URL válida de webhook antes de testar.');
      return;
    }
    setIsTestingWebhook(true);
    setDiagnosticError(null);
    try {
      const result = await apiFetch<{ success: boolean; status: number; statusText: string }>('/api/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: settings.webhookUrl.trim() }),
      });
      
      if (result.success) {
        toast.success(
          'Sucesso!', 
          `Webhook testado com sucesso! Recebemos status ${result.status} (${result.statusText || 'OK'}) do Make.`
        );
      } else {
        toast.error(
          'Falha no Webhook', 
          `O webhook respondeu com status ${result.status}. Verifique se o seu fluxo está ativo no Make.`
        );
      }
    } catch (err: any) {
      setDiagnosticError({
        endpoint: '/api/test-webhook',
        method: 'POST',
        message: err.message,
        timestamp: new Date().toLocaleTimeString()
      });
      toast.error('Erro de conexão', err.message || 'Não foi possível conectar ao servidor para o teste.');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Helper additions for entities
  const handleAddComment = () => {
    const newC: SyncComment = {
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      time: 60,
      name: 'Novo Comentador',
      photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      message: 'Comentário teste sincronizado.'
    };
    handleSaveComments([...comments, newC]);
  };

  const handleAddMaterial = () => {
    const newM: Material = {
      id: 'm_' + Math.random().toString(36).substr(2, 9),
      title: 'Novo Material para Download',
      type: 'PDF',
      url: 'https://google.com',
      description: 'Descrição do material para apoiar a aula.'
    };
    handleSaveMaterials([...materials, newM]);
  };

  const handleAddFAQ = () => {
    const newF: FAQItem = {
      id: 'f_' + Math.random().toString(36).substr(2, 9),
      question: 'Nova pergunta do FAQ?',
      answer: 'Resposta explicativa correspondente para o FAQ.',
      order: faq.length + 1
    };
    handleSaveFAQ([...faq, newF]);
  };

  const handleAddBonus = () => {
    const newB: Bonus = {
      id: 'b_' + Math.random().toString(36).substr(2, 9),
      title: 'Bônus Extra Exclusivo',
      description: 'Detalhamento do bônus fornecido.',
      value: 'R$ 497',
      imageUrl: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=400&h=250&q=80'
    };
    handleSaveBonuses([...bonuses, newB]);
  };

  const handleAddTestimonial = () => {
    const newT: Testimonial = {
      id: 't_' + Math.random().toString(36).substr(2, 9),
      name: 'Novo Aluno Satisfeito',
      photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      text: 'Apliquei o método e consegui colher resultados incríveis em poucos dias.',
      rating: 5
    };
    handleSaveTestimonials([...testimonials, newT]);
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-light flex min-h-screen items-center justify-center bg-[#F7F5FB] text-zinc-100 font-sans px-4 select-none">
        <div className="w-full max-w-sm bg-[#FFFFFF] border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3"><BeConfidentMark size={52} /></div>
            <h2 className="text-xl font-bold">Acesso Restrito</h2>
            <p className="text-xs text-zinc-400 mt-1">Entre com seu e-mail e senha de administrador.</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-xs font-medium text-zinc-300">E-mail</label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="voce@beconfident.app"
                className="w-full px-3.5 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-[#8134FE]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-xs font-medium text-zinc-300">Senha</label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full px-3.5 py-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-[#8134FE]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-3 text-xs bg-zinc-900 hover:bg-zinc-850 text-zinc-400 font-semibold rounded-lg border border-zinc-800 transition-colors cursor-pointer"
              >
                Voltar à Sala
              </button>
              <button
                type="submit"
                className="flex-1 py-3 text-xs bg-[#7E2EFF] hover:bg-[#6419DB] text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isLoggingIn ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const NAV: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    { id: 'leads', label: 'Leads', icon: <UserCheck className="h-[18px] w-[18px]" /> },
    { id: 'webinar', label: 'Vídeos', icon: <Video className="h-[18px] w-[18px]" /> },
    { id: 'questions', label: 'Sala ao vivo', icon: <Radio className="h-[18px] w-[18px]" /> },
    { id: 'users', label: 'Progresso dos alunos', icon: <TrendingUp className="h-[18px] w-[18px]" /> },
    { id: 'content', label: 'Conteúdos da sala', icon: <MessageSquareCode className="h-[18px] w-[18px]" /> },
    { id: 'admins', label: 'Usuários', icon: <UserCog className="h-[18px] w-[18px]" /> },
  ];
  const PAGE_TITLES: Record<string, string> = {
    dashboard: 'Dashboard geral',
    leads: 'Leads',
    webinar: 'Vídeos',
    questions: 'Sala ao vivo',
    users: 'Progresso dos alunos',
    content: 'Conteúdos da sala',
    admins: 'Usuários',
  };

  return (
    <div className="admin-light min-h-screen font-sans select-none lg:flex">
      {/* Left sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen border-r transition-all duration-200 ${sidebarCollapsed ? 'w-[76px]' : 'w-[248px]'}`}
        style={{ background: '#FFFFFF', borderColor: '#ECE7F5' }}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <BeConfidentMark size={36} />
            {!sidebarCollapsed && (
              <span className="flex flex-col leading-tight min-w-0">
                <span className="text-[15px] font-semibold truncate" style={{ color: '#20044E' }}>BeConfident</span>
                <span className="text-[11px] truncate" style={{ color: '#8A8199' }}>Webinar</span>
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className="w-7 h-7 rounded-full border flex items-center justify-center cursor-pointer shrink-0 hover:opacity-80"
            style={{ borderColor: '#ECE7F5', color: '#4A4060', background: '#FFFFFF' }}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-colors cursor-pointer ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}`}
                style={active ? { background: '#F2EBFF', color: '#6419DB' } : { color: '#4A4060' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F7F5FB'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: active ? '#7E2EFF' : '#8A8199' }}>{item.icon}</span>
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {!sidebarCollapsed && item.id === 'leads' && leads.length > 0 && (
                  <span className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: '#F2EBFF', color: '#6419DB' }}>{leads.length}</span>
                )}
                {!sidebarCollapsed && item.id === 'questions' && settings.isLiveActive !== false && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: '#ECE7F5' }}>
          <button
            onClick={onBack}
            title="Ver a sala do webinar"
            className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium cursor-pointer hover:opacity-80 ${sidebarCollapsed ? 'justify-center py-2.5' : 'px-3 py-2.5'}`}
            style={{ color: '#4A4060' }}
          >
            <ExternalLink className="h-[18px] w-[18px]" style={{ color: '#8A8199' }} />
            {!sidebarCollapsed && 'Ver sala do webinar'}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
      {/* Mobile menu (horizontal) */}
      <div className="lg:hidden sticky top-0 z-40 border-b px-4 py-3 flex items-center gap-3 overflow-x-auto" style={{ background: '#FFFFFF', borderColor: '#ECE7F5' }}>
        <BeConfidentMark size={32} />
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer"
            style={activeTab === item.id ? { background: '#F2EBFF', color: '#6419DB' } : { color: '#4A4060' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Page header */}
      <header className="px-4 sm:px-8 pt-6 pb-2 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight" style={{ color: '#20044E' }}>
          {PAGE_TITLES[activeTab] || 'Painel'}
        </h1>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] font-mono text-zinc-400">
            <Database className="h-3 w-3 text-emerald-400" />
            <span>{dbStatus?.storage || "Banco de dados"}</span>
          </div>
          <button
            onClick={() => {
              setShowDiagnosticPanel(true);
              runDiagnosticCheck();
            }}
            className="px-3 py-1.5 bg-[#8134FE]/10 hover:bg-[#8134FE]/20 border border-[#8134FE]/40 text-[#6419DB] font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Diagnóstico API</span>
          </button>
          <button
            onClick={fetchAllData}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sincronizar
          </button>
          <button
            onClick={handleAdminLogout}
            title={adminAuth.getSession()?.email || 'Sair'}
            className="p-2 bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 text-zinc-400 hover:text-red-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="px-4 sm:px-8 py-4 lg:py-6 max-w-[1500px]">
        
        {/* Diagnostic Error Banner if an error occurred on save */}
        {diagnosticError && (
          <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl mb-6 text-red-200 text-xs space-y-2.5 font-mono shadow-xl">
            <div className="flex justify-between items-center border-b border-red-900/60 pb-2">
              <div className="flex items-center gap-2 font-bold text-red-400 text-sm">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                <span>ERRO DE SALVAMENTO DETECTADO EM PRODUÇÃO</span>
              </div>
              <button 
                onClick={() => setDiagnosticError(null)}
                className="text-red-400 hover:text-white text-xs px-2 py-1 rounded border border-red-800/80 bg-red-900/50 cursor-pointer"
              >
                Fechar aviso
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-black/50 p-3 rounded-lg border border-red-900/40 text-[11px]">
              <div><span className="text-zinc-500">Endpoint Chamado:</span> <span className="text-white font-bold">{diagnosticError.method} {diagnosticError.endpoint}</span></div>
              <div><span className="text-zinc-500">Horário da Falha:</span> <span className="text-white">{diagnosticError.timestamp}</span></div>
              <div><span className="text-zinc-500">Diagnóstico:</span> <span className="text-red-400 font-bold">Incapaz de Salvar no Servidor</span></div>
            </div>

            <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-200 leading-relaxed font-mono">
              <p className="font-bold text-red-300 mb-1 flex items-center gap-1">
                <Terminal className="h-3.5 w-3.5 text-red-400" />
                Mensagem Técnica Específica Retornada:
              </p>
              <p className="break-all text-white bg-black/60 p-2.5 rounded border border-red-900/30 font-mono text-[11px]">
                {diagnosticError.message}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-sans">
              <p className="text-[11px] text-zinc-400">
                💡 <strong>Dica:</strong> Se a mensagem indicar HTTP 404 ou formato não-JSON, verifique se a rota `/api/...` está sendo encaminhada pelo servidor de hospedagem.
              </p>
              <button
                onClick={() => {
                  setShowDiagnosticPanel(true);
                  runDiagnosticCheck();
                }}
                className="px-3.5 py-2 bg-red-800 hover:bg-red-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5" />
                Executar Teste Completo de Diagnóstico
              </button>
            </div>
          </div>
        )}

        {/* Diagnostic Modal Panel */}
        <AnimatePresence>
          {showDiagnosticPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-2xl bg-[#F2EBFF] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-200 font-sans max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Ferramenta de Diagnóstico da API</h3>
                      <p className="text-xs text-slate-400">Validação técnica em tempo real das rotas de leitura e escrita do servidor.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDiagnosticPanel(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>

                {/* DB & Environment Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400">Modo de Armazenamento:</span>
                    <p className="text-sm font-bold text-emerald-400">
                      💾 {dbStatus?.storage || "Banco de dados"}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-slate-400">Status do Servidor API:</span>
                    <p className="text-sm font-bold text-emerald-400">
                      ✅ Servidor Ativo (Porta 3000)
                    </p>
                  </div>
                </div>

                {/* Diagnostic Action */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-semibold text-slate-300">Testes de Leitura e Escrita HTTP</span>
                  <button
                    onClick={runDiagnosticCheck}
                    disabled={isRunningDiagnostic}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
                    {isRunningDiagnostic ? 'Executando Teste...' : 'Iniciar Teste de Diagnóstico'}
                  </button>
                </div>

                {/* Diagnostic Log Output */}
                {diagnosticLogs ? (
                  <div className="space-y-3 pt-2 font-mono text-xs">
                    {diagnosticLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border ${
                          log.status === 'success' 
                            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                            : 'bg-red-950/30 border-red-800/50 text-red-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1 font-bold">
                          <span className="flex items-center gap-2">
                            {log.status === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                            )}
                            {log.step}
                          </span>
                          {log.latencyMs !== undefined && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                              {log.latencyMs} ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 pl-6 leading-relaxed break-all">
                          {log.details}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Clique em &quot;Iniciar Teste de Diagnóstico&quot; para testar a comunicação com a API.
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowDiagnosticPanel(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Tab Contents */}
        <AnimatePresence mode="wait">
          
          {activeTab === 'dashboard' && <DashboardPanel leads={leads} stats={stats} settings={settings} />}

          {/* DEDICATED LEADS TAB */}
          {activeTab === 'leads' && (
            <motion.div
              key="leads-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header Banner & Controls */}
              <div className="p-6 bg-[#FFFFFF] border border-zinc-800 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-emerald-400" />
                      Gestão de Leads & Retenção
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Visualize todos os alunos que acessaram a sala de aula, quanto tempo assistiram do vídeo e se clicaram no botão da oferta.
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleExportCsv}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      Exportar Lista (CSV)
                    </button>
                    <button
                      onClick={handleRefreshLeads}
                      disabled={isRefreshingLeads}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white font-medium text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-emerald-400 ${isRefreshingLeads ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingLeads ? 'Atualizando...' : 'Atualizar Dados dos Leads'}</span>
                    </button>
                  </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="relative sm:col-span-2">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou WhatsApp..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <select
                      value={leadFilterCta}
                      onChange={(e: any) => setLeadFilterCta(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-xl text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="all">Todos os Leads ({leads.length})</option>
                      <option value="clicked">✓ Clicaram na Oferta ({leads.filter(l => l.clickedCta).length})</option>
                      <option value="not_clicked">— Não Clicaram na Oferta ({leads.filter(l => !l.clickedCta).length})</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Leads Filtrados</p>
                  <p className="text-xl font-bold text-white font-mono">{filteredLeads.length} <span className="text-xs font-normal text-zinc-500">de {leads.length}</span></p>
                </div>

                <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Clicaram na Oferta</p>
                  <p className="text-xl font-bold text-emerald-400 font-mono">
                    {leads.filter(l => l.clickedCta).length} 
                    <span className="text-xs font-normal text-zinc-400 ml-1.5">
                      ({leads.length > 0 ? ((leads.filter(l => l.clickedCta).length / leads.length) * 100).toFixed(1) : 0}% conv.)
                    </span>
                  </p>
                </div>

                <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Tempo Médio Assistido</p>
                  <p className="text-xl font-bold text-amber-300 font-mono">
                    {formatSecondsToMMSS(leads.length > 0 ? Math.round(leads.reduce((a, b) => a + (b.watchedSeconds || 0), 0) / leads.length) : 0)}
                  </p>
                </div>

                <div className="p-4 bg-zinc-950/80 border border-zinc-900 rounded-xl">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Concluíram (+90%)</p>
                  <p className="text-xl font-bold text-sky-400 font-mono">
                    {leads.filter(l => l.completed || (l.durationSeconds > 0 && (l.watchedSeconds / l.durationSeconds) >= 0.9)).length}
                  </p>
                </div>
              </div>

              {/* Leads Table */}
              <div className="bg-[#FFFFFF] border border-zinc-800 rounded-2xl overflow-hidden">
                {filteredLeads.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <Users className="h-10 w-10 text-zinc-600 mx-auto" />
                    <p className="text-sm text-zinc-400 font-medium">Nenhum lead encontrado com o filtro atual.</p>
                    <p className="text-xs text-zinc-500">Tente ajustar a busca por nome ou redefinir o filtro de cliques.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-mono uppercase text-zinc-400">
                          <th className="p-4 pl-6">Aluno / Lead</th>
                          <th className="p-4">WhatsApp</th>
                          <th className="p-4">Data/Hora Entrada</th>
                          <th className="p-4">Tempo Assistido</th>
                          <th className="p-4">Clicou na Oferta?</th>
                          <th className="p-4 pr-6 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/60 text-xs">
                        {filteredLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="p-4 pl-6 font-medium text-white">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700 flex items-center justify-center text-xs font-bold text-emerald-400">
                                  {lead.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-white">{lead.name}</p>
                                    {lead.isOnline && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full text-[9px] font-bold">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE AGORA
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-zinc-500 font-mono">ID: {lead.id.slice(0, 10)}</span>
                                </div>
                              </div>
                            </td>

                            <td className="p-4 text-zinc-300 font-mono">
                              <div className="flex items-center gap-2">
                                <span className="select-all font-semibold text-emerald-400">{lead.email}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(lead.email);
                                    toast.success('Copiado!', `WhatsApp ${lead.email} copiado.`);
                                  }}
                                  title="Copiar WhatsApp"
                                  className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                                >
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </button>
                                {lead.email && (
                                  <a
                                    href={`https://wa.me/${lead.email.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Abrir no WhatsApp"
                                    className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                  >
                                    Conversar
                                  </a>
                                )}
                              </div>
                            </td>

                            <td className="p-4 text-zinc-400 font-mono text-[11px]">
                              {new Date(lead.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>

                            <td className="p-4">
                              <div className="space-y-1">
                                <span className="font-mono text-white font-bold text-xs">
                                  {formatSecondsToMMSS(lead.watchedSeconds)}
                                </span>
                                {lead.durationSeconds > 0 && (
                                  <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-amber-400 rounded-full"
                                      style={{ width: `${Math.min(100, Math.round((lead.watchedSeconds / lead.durationSeconds) * 100))}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="p-4">
                              <button
                                onClick={() => handleToggleLeadCta(lead.id, lead.email, !!lead.clickedCta)}
                                title="Clique para alternar o status do clique na oferta do lead"
                                className="text-left group cursor-pointer"
                              >
                                {lead.clickedCta ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 group-hover:bg-amber-500/20 group-hover:text-amber-300 group-hover:border-amber-500/40 rounded-full text-xs font-bold transition-all">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      Sim (Clicou Oferta)
                                    </span>
                                    {lead.ctaClickTime && (
                                      <p className="text-[10px] text-zinc-500 font-mono">
                                        {new Date(lead.ctaClickTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-500 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 group-hover:border-emerald-500/40 rounded-full text-xs transition-all">
                                    — Não Clicou
                                  </span>
                                )}
                              </button>
                            </td>

                            <td className="p-4 pr-6 text-right">
                              <button
                                onClick={() => handleDeleteLead(lead.id, lead.name)}
                                title="Excluir Lead"
                                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* WEBINAR & CTA SETTINGS TAB */}
          {activeTab === 'webinar' && (
            <motion.div
              key="webinar-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#FFFFFF] border border-zinc-800 p-6 rounded-2xl"
            >
              <h3 className="text-base font-semibold text-white mb-5 border-b border-zinc-800 pb-3">Configurações Gerais do Webinar</h3>

              <div className="mb-6 p-4 rounded-xl border border-emerald-800/60 bg-emerald-950/20 text-emerald-200 text-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-xs md:text-sm">
                      Servidor e Banco de Dados Ativos
                    </p>
                    <p className="text-xs opacity-80 leading-relaxed">
                      Todas as alterações de configurações, bônus, materiais, dados de alunos e ofertas são salvas automaticamente em tempo real no servidor backend.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                
                {/* Visual Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label htmlFor="settings-logo-text" className="text-xs font-medium text-zinc-300">Nome do Webinar (Logo)</label>
                    <input
                      id="settings-logo-text"
                      type="text"
                      value={settings.logoText}
                      onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="settings-title" className="text-xs font-medium text-zinc-300">Nome da Aula / Título Principal (Headline)</label>
                    <input
                      id="settings-title"
                      type="text"
                      value={settings.title}
                      onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label htmlFor="settings-desc" className="text-xs font-medium text-zinc-300">Descrição do Webinar</label>
                    <textarea
                      id="settings-desc"
                      rows={2}
                      value={settings.description}
                      onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label htmlFor="settings-video" className="text-xs font-medium text-zinc-300">URL do Vídeo (Hospedado/Vimeo Direct Links)</label>
                    <input
                      id="settings-video"
                      type="text"
                      value={settings.videoUrl}
                      onChange={(e) => setSettings({ ...settings, videoUrl: e.target.value })}
                      className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* SMART CTA Settings */}
                <div className="border-t border-zinc-800 pt-5 mt-6">
                  <h4 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-1.5 font-mono">
                    <CheckSquare className="h-4 w-4" />
                    CONFIGURAÇÃO DO CTA INTELIGENTE
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label htmlFor="settings-cta-trigger-type" className="text-xs font-medium text-zinc-300">Tipo de Gatilho do CTA</label>
                      <select
                        id="settings-cta-trigger-type"
                        value={settings.ctaType}
                        onChange={(e) => setSettings({ ...settings, ctaType: e.target.value as 'time' | 'percentage' })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                      >
                        <option value="time">Por tempo assistido (X segundos)</option>
                        <option value="percentage">Por porcentagem do vídeo (X %)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-cta-value" className="text-xs font-medium text-zinc-300">Valor do Gatilho (X)</label>
                      <input
                        id="settings-cta-value"
                        type="number"
                        value={settings.ctaTriggerValue}
                        onChange={(e) => setSettings({ ...settings, ctaTriggerValue: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-offer-title" className="text-xs font-medium text-zinc-300">Título/Badge da Oferta</label>
                      <input
                        id="settings-offer-title"
                        type="text"
                        value={settings.offerTitle ?? ''}
                        placeholder="Ex: Oferta Especial Disponível"
                        onChange={(e) => setSettings({ ...settings, offerTitle: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-offer-btn-text" className="text-xs font-medium text-zinc-300">Texto do Botão da Oferta</label>
                      <input
                        id="settings-offer-btn-text"
                        type="text"
                        value={settings.offerBtnText ?? ''}
                        placeholder="Ex: Quero Aproveitar a Oferta"
                        onChange={(e) => setSettings({ ...settings, offerBtnText: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="settings-cta-text" className="text-xs font-medium text-zinc-300">Texto de Descrição da Oferta (Headline)</label>
                      <input
                        id="settings-cta-text"
                        type="text"
                        value={settings.ctaText}
                        onChange={(e) => setSettings({ ...settings, ctaText: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-cta-link" className="text-xs font-medium text-zinc-300">Link do Botão CTA (checkout / Checkout URL)</label>
                      <input
                        id="settings-cta-link"
                        type="text"
                        value={settings.ctaLink}
                        onChange={(e) => setSettings({ ...settings, ctaLink: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="settings-offer-duration" className="text-xs font-medium text-zinc-300">Tempo do Contador da Oferta (em segundos - ex: 600 para 10 minutos)</label>
                      <input
                        id="settings-offer-duration"
                        type="number"
                        value={settings.offerDuration || 600}
                        onChange={(e) => setSettings({ ...settings, offerDuration: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2 border-t border-zinc-900 pt-4 mt-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">Personalização da Aba Oferta (Lateral)</span>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-tab-offer-title" className="text-xs font-medium text-zinc-300">Título Principal da Aba Oferta</label>
                      <input
                        id="settings-tab-offer-title"
                        type="text"
                        value={settings.tabOfferTitle ?? ''}
                        placeholder="Ex: Oportunidade Exclusiva"
                        onChange={(e) => setSettings({ ...settings, tabOfferTitle: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-tab-offer-subtitle" className="text-xs font-medium text-zinc-300">Subtítulo da Aba Oferta</label>
                      <input
                        id="settings-tab-offer-subtitle"
                        type="text"
                        value={settings.tabOfferSubtitle ?? ''}
                        placeholder="Ex: Esta oferta expira em breve. Garanta sua vaga com desconto!"
                        onChange={(e) => setSettings({ ...settings, tabOfferSubtitle: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label htmlFor="settings-tab-offer-desc" className="text-xs font-medium text-zinc-300">Descrição / Bônus Inclusos (um por linha)</label>
                      <textarea
                        id="settings-tab-offer-desc"
                        rows={4}
                        value={settings.tabOfferDescription ?? ''}
                        placeholder="✓ Bônus Exclusivos Inclusos&#10;✓ Acesso imediato à área de membros&#10;✓ Suporte VIP & Certificação Completa"
                        onChange={(e) => setSettings({ ...settings, tabOfferDescription: e.target.value })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-sans"
                      />
                    </div>
                  </div>
                </div>

                {/* Color Branding Settings */}
                <div className="border-t border-zinc-800 pt-5 mt-6">
                  <h4 className="text-sm font-semibold text-sky-400 mb-4 flex items-center gap-1.5 font-mono">
                    <Settings className="h-4 w-4" />
                    IDENTIDADE VISUAL DA SALA
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label htmlFor="settings-primary-color" className="text-xs font-medium text-zinc-300">Cor Primária (Hex)</label>
                      <div className="flex gap-2">
                        <input
                          id="settings-primary-color"
                          type="color"
                          value={settings.primaryColor}
                          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="w-12 h-10 bg-transparent border-none cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.primaryColor}
                          onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                          className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white font-mono focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-secondary-color" className="text-xs font-medium text-zinc-300">Cor Secundária (Hex)</label>
                      <div className="flex gap-2">
                        <input
                          id="settings-secondary-color"
                          type="color"
                          value={settings.secondaryColor}
                          onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                          className="w-12 h-10 bg-transparent border-none cursor-pointer"
                        />
                        <input
                          type="text"
                          value={settings.secondaryColor}
                          onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                          className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated Live Viewers Range */}
                <div className="border-t border-zinc-800 pt-5 mt-6">
                  <h4 className="text-sm font-semibold text-cyan-400 mb-4 flex items-center gap-1.5 font-mono">
                    <Users className="h-4 w-4" />
                    AUDIÊNCIA AO VIVO SIMULADA
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label htmlFor="settings-live-min-users" className="text-xs font-medium text-zinc-300">Mínimo de Pessoas Ao Vivo</label>
                      <input
                        id="settings-live-min-users"
                        type="number"
                        min={0}
                        value={settings.liveMinUsers ?? 20}
                        onChange={(e) => setSettings({ ...settings, liveMinUsers: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="settings-live-max-users" className="text-xs font-medium text-zinc-300">Máximo de Pessoas Ao Vivo</label>
                      <input
                        id="settings-live-max-users"
                        type="number"
                        min={0}
                        value={settings.liveMaxUsers ?? 35}
                        onChange={(e) => setSettings({ ...settings, liveMaxUsers: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Scheduled Live Settings */}
                <div className="border-t border-zinc-800 pt-5 mt-6">
                  <h4 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-1.5 font-mono">
                    <Calendar className="h-4 w-4" />
                    AGENDAMENTO DA TRANSMISSÃO AO VIVO
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <input
                        id="settings-is-scheduled"
                        type="checkbox"
                        checked={settings.isScheduled || false}
                        onChange={(e) => setSettings({ ...settings, isScheduled: e.target.checked })}
                        className="w-4 h-4 mt-0.5 rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="space-y-1 select-none">
                        <label htmlFor="settings-is-scheduled" className="text-xs font-semibold text-zinc-200 cursor-pointer">
                          Definir uma Data/Hora específica para o início
                        </label>
                        <p className="text-[10px] text-zinc-500">
                          Se ativado, os leads que entrarem antes do horário verão uma tela de contagem regressiva. A transmissão começará sincronizada para todos exatamente no momento agendado.
                        </p>
                      </div>
                    </div>

                    {settings.isScheduled && (
                      <div className="space-y-1.5 max-w-md animate-fadeIn">
                        <label htmlFor="settings-scheduled-datetime" className="text-xs font-medium text-zinc-300">Data e Hora do Início (fuso horário local)</label>
                        <input
                          id="settings-scheduled-datetime"
                          type="datetime-local"
                          value={settings.scheduledDateTime || ''}
                          onChange={(e) => setSettings({ ...settings, scheduledDateTime: e.target.value })}
                          className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-lg text-sm text-white focus:outline-none font-mono"
                          required={settings.isScheduled}
                        />
                      </div>
                    )}
                  </div>
                </div>



                <div className="border-t border-zinc-800 pt-5 mt-6 flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSaveAsDefault}
                    disabled={isSaving}
                    className="px-5 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-semibold rounded-lg border border-amber-500/30 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4.5 w-4.5" />
                    Salvar como Padrão
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="h-4.5 w-4.5" />
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>

              </form>
            </motion.div>
          )}

          {/* LIVE CONTROL ROOM TAB ("Ao Vivo") */}
          {activeTab === 'questions' && (
            <motion.div
              key="live-control-room"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header Live Status Banner */}
              <div className={`border p-5 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                settings.isLiveActive !== false 
                  ? 'bg-gradient-to-r from-red-950/70 via-zinc-900 to-zinc-900 border-red-800/50' 
                  : 'bg-zinc-950 border-amber-900/40'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    {settings.isLiveActive !== false ? (
                      <>
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest text-red-400">
                          PAINEL AO VIVO • TRANSMISSÃO NO AR
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-3 w-3 rounded-full bg-zinc-600 border border-zinc-400"></span>
                        <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                          TRANSMISSÃO DESLIGADA • SALA OFFLINE
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {settings.title || 'Transmissão do Webinar'}
                  </h3>
                </div>

                {/* Live Controls & Status Toggle */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleToggleLiveStatus}
                    disabled={isSaving}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                      settings.isLiveActive !== false
                        ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/30'
                    }`}
                  >
                    <Radio className={`h-4 w-4 ${settings.isLiveActive !== false ? 'animate-pulse' : ''}`} />
                    <span>
                      {settings.isLiveActive !== false ? 'Desligar Transmissão (Offline)' : 'Ligar Transmissão Ao Vivo'}
                    </span>
                  </button>

                  <div className="bg-zinc-950/80 border border-zinc-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-400" />
                    <div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cadastrados Reais</div>
                      <div className="text-xs font-black text-emerald-400 font-mono">
                        {leads.length} alunos
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-950/80 border border-zinc-800 px-3.5 py-2 rounded-xl flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-amber-400" />
                    <div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Clicaram na Oferta</div>
                      <div className="text-xs font-black text-amber-400 font-mono">
                        {leads.filter(l => l.clickedCta).length} ({leads.length > 0 ? Math.round((leads.filter(l => l.clickedCta).length / leads.length) * 100) : 0}%)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONSOLIDATED SESSION DATA (When Live is Offline) */}
              {settings.isLiveActive === false && (
                <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-bold font-mono">
                        📊 DADOS CONSOLIDADOS DA TRANSMISSÃO
                      </div>
                      <h4 className="text-xl font-black text-white tracking-tight">
                        Resumo Final da Sessão (Transmissão Finalizada)
                      </h4>
                      <p className="text-xs text-zinc-400">
                        A transmissão está desligada. Abaixo estão os dados e estatísticas consolidados em minutos, dispositivos e IPs dos participantes.
                      </p>
                    </div>

                    <button
                      onClick={() => handleExportConsolidatedCSV('dados_consolidados_live')}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      Exportar Dados Consolidados (CSV)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase font-mono block mb-1">Total de Alunos</span>
                      <p className="text-2xl font-black text-white font-mono">{leads.length}</p>
                      <span className="text-[10px] text-zinc-500">Participantes registrados</span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase font-mono block mb-1">Tempo Mambro Retenção</span>
                      <p className="text-2xl font-black text-emerald-400 font-mono">
                        {(stats.avgWatchTime / 60).toFixed(1)} min
                      </p>
                      <span className="text-[10px] text-zinc-500">({formatSecondsToMMSS(stats.avgWatchTime)} em média)</span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase font-mono block mb-1">Cliques na Oferta (CTA)</span>
                      <p className="text-2xl font-black text-amber-400 font-mono">{stats.ctaClicks}</p>
                      <span className="text-[10px] text-zinc-500">Taxa: {leads.length > 0 ? ((stats.ctaClicks / leads.length) * 100).toFixed(1) : 0}% CTR</span>
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase font-mono block mb-1">Dispositivos Principais</span>
                      <p className="text-2xl font-black text-sky-400 font-mono flex items-center gap-2">
                        <span>📱 {leads.length > 0 ? Math.round((leads.filter(l => (l.device || '').toLowerCase().includes('mobile') || (l.device || '').toLowerCase().includes('iphone')).length / leads.length) * 100) : 0}%</span>
                        <span className="text-xs text-zinc-400 font-normal">Mobile</span>
                      </p>
                      <span className="text-[10px] text-zinc-500">💻 Desktop: {leads.length > 0 ? Math.round((leads.filter(l => !(l.device || '').toLowerCase().includes('mobile') && !(l.device || '').toLowerCase().includes('iphone')).length / leads.length) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub Navigation inside Ao Vivo */}
              <div className="flex flex-wrap border-b border-zinc-800 gap-2 pb-2">
                <button
                  onClick={() => setLiveSubTab('map')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    liveSubTab === 'map'
                      ? 'bg-zinc-900 text-white border border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  <MapPin className="h-4 w-4 text-[#8134FE]" />
                  <span>Mapa & Radar de Viewers (IP)</span>
                  <span className="w-2 h-2 rounded-full bg-[#8134FE] animate-ping" />
                </button>

                <button
                  onClick={() => setLiveSubTab('audience')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    liveSubTab === 'audience'
                      ? 'bg-zinc-900 text-white border border-zinc-700/80 shadow-md'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Users className="h-4 w-4 text-emerald-400" />
                  Alunos Conectados ({stats.activeUsers || (leads.length > 0 ? 1 : 0)})
                </button>

                <button
                  onClick={() => setLiveSubTab('chat')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    liveSubTab === 'chat'
                      ? 'bg-zinc-900 text-white border border-zinc-700/80 shadow-md'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 text-sky-400" />
                  Chat & Moderação Ao Vivo ({realComments.length})
                </button>

                <button
                  onClick={() => setLiveSubTab('questions')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    liveSubTab === 'questions'
                      ? 'bg-zinc-900 text-white border border-zinc-700/80 shadow-md'
                      : 'text-zinc-400 hover:text-white border border-transparent'
                  }`}
                >
                  <HelpCircle className="h-4 w-4 text-purple-400" />
                  Perguntas dos Alunos ({questions.length})
                  {questions.filter(q => !q.answered).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>
              </div>

              {/* SUB TAB 0: MAPA RADAR AO VIVO (LEAFLET + DARK MATTER + RADAR PULSE) */}
              {liveSubTab === 'map' && (
                <div className="space-y-4">
                  <LiveMonitoringMap
                    isLiveActive={settings.isLiveActive !== false}
                    onToggleLiveStatus={handleToggleLiveStatus}
                    registeredLeads={leads}
                  />
                </div>
              )}

              {/* SUB TAB 1: PESSOAS ASSISTINDO AGORA (AUDIENCE) */}
              {liveSubTab === 'audience' && (
                <div className="bg-[#FFFFFF] border border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-400" />
                        Acompanhamento de Alunos / Leads em Tempo Real
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Acompanhe em tempo real quem está conectado e assistindo à transmissão com dispositivo, IP e tempo em minutos.
                      </p>
                    </div>

                    <button
                      onClick={() => handleExportConsolidatedCSV('audiencia_ao_vivo')}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exportar Lista (Minutos/IP)
                    </button>
                  </div>

                  {/* Real-time Online Audience Summary Box */}
                  {(() => {
                    const onlineLeads = leads.filter(l => l.isOnline);
                    const activeLiveList = onlineLeads;
                    const activeLiveCount = onlineLeads.length;

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 shrink-0">
                              <Radio className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                              <div className="text-[11px] text-zinc-400 font-semibold">Pessoas Online na Live Agora</div>
                              <div className="text-lg font-black text-white font-mono flex items-center gap-2">
                                <span>{activeLiveCount}</span>
                                {activeLiveCount > 0 && (
                                  <span className="text-[10px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-sans font-bold border border-red-500/30">
                                    AO VIVO
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-[11px] text-zinc-400 font-semibold">Cadastrados que Entraram</div>
                              <div className="text-lg font-black text-emerald-400 font-mono">
                                {leads.length} alunos
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0">
                              <MousePointerClick className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="text-[11px] text-zinc-400 font-semibold">Clicaram no Botão de Oferta</div>
                              <div className="text-lg font-black text-amber-400 font-mono">
                                {leads.filter(l => l.clickedCta).length} alunos
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CAMPO DEDICADO COM NOMES DAS PESSOAS AO VIVO AGORA */}
                        <div className="bg-zinc-950 border border-emerald-500/40 rounded-xl p-4 space-y-3 shadow-xl">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-zinc-800/80 pb-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                              </span>
                              <h5 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
                                <span>🟢 Nomes das Pessoas Ao Vivo Agora na Sala</span>
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-sans font-bold">
                                  {activeLiveCount} Participante(s)
                                </span>
                              </h5>
                            </div>
                            <span className="text-[11px] text-zinc-400 font-mono">
                              Conexão ativa em tempo real
                            </span>
                          </div>

                          {/* Grid de Crachás/Nomes das Pessoas Online */}
                          <div className="flex flex-wrap gap-2 pt-1 max-h-48 overflow-y-auto custom-scrollbar">
                            {activeLiveList.length === 0 ? (
                              <div className="text-xs text-zinc-500 italic p-2 w-full text-center bg-zinc-900/40 rounded-lg border border-dashed border-zinc-800">
                                Aguardando entrada de participantes na live... À medida que entrarem, os nomes aparecerão aqui em tempo real.
                              </div>
                            ) : (
                              activeLiveList.map((lead) => (
                                <div 
                                  key={`live-chip-${lead.id}`}
                                  className="inline-flex flex-wrap items-center gap-2 bg-zinc-900 border border-emerald-500/30 hover:border-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all"
                                >
                                  <span className="flex h-2 w-2 relative shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  <span className="font-bold text-white">{lead.name}</span>
                                  {lead.email && (
                                    <span className="text-[10px] text-emerald-400 font-mono">({lead.email})</span>
                                  )}
                                  <span className="text-[10px] text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 font-mono">
                                    ⏱️ {(lead.watchedSeconds / 60).toFixed(1)} min
                                  </span>
                                  <span className="text-[10px] text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60 font-mono flex items-center gap-1">
                                    {getDeviceIcon(lead.device)}
                                    <span>{lead.device || 'Desktop'}</span>
                                  </span>
                                  {lead.ip && (
                                    <span className="text-[10px] text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 font-mono">
                                      🌐 {lead.ip}
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {leads.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 text-xs bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
                      Nenhum aluno entrou na sala até o momento. À medida que as pessoas acessarem a sala, elas aparecerão aqui em tempo real.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] font-mono uppercase text-zinc-400">
                            <th className="p-3.5 pl-5">Aluno / Lead</th>
                            <th className="p-3.5">WhatsApp</th>
                            <th className="p-3.5">Tempo Assistido (Minutos)</th>
                            <th className="p-3.5">Dispositivo</th>
                            <th className="p-3.5">Endereço IP</th>
                            <th className="p-3.5">Clicou Oferta?</th>
                            <th className="p-3.5">Horário Entrada</th>
                            <th className="p-3.5 pr-5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-xs">
                          {leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-zinc-900/40 transition-colors">
                              <td className="p-3.5 pl-5 font-semibold text-white">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                                    {lead.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="block font-bold text-white">{lead.name}</span>
                                    {lead.isOnline && (
                                      <span className="text-[9px] text-emerald-400 font-mono uppercase font-bold">Online Agora</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="p-3.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-emerald-400 font-semibold">{lead.email}</span>
                                  {lead.email && (
                                    <a
                                      href={`https://wa.me/${lead.email.replace(/\D/g, '')}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Abrir no WhatsApp"
                                      className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      Conversar
                                    </a>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="text-emerald-400 font-black text-xs">
                                      {(lead.watchedSeconds / 60).toFixed(1)} min
                                    </span>
                                    <span className="text-[10px] text-zinc-400">
                                      ({formatSecondsToMMSS(lead.watchedSeconds)})
                                    </span>
                                  </div>
                                  {lead.durationSeconds > 0 && (
                                    <div className="w-24 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-amber-400 rounded-full"
                                        style={{ width: `${Math.min(100, Math.round((lead.watchedSeconds / lead.durationSeconds) * 100))}%` }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg text-[11px] font-medium font-mono">
                                  {getDeviceIcon(lead.device)}
                                  <span>{lead.device || 'Desktop'}</span>
                                </span>
                              </td>

                              <td className="p-3.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-800/80 font-mono text-zinc-400 text-[11px] rounded">
                                  <Globe className="h-3 w-3 text-zinc-500 shrink-0" />
                                  <span>{lead.ip || '---'}</span>
                                </span>
                              </td>

                              <td className="p-3.5">
                                {lead.clickedCta ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-[11px] font-bold">
                                    <CheckCircle2 className="h-3 w-3" /> Clicou Oferta
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 text-[11px]">Não Clicou</span>
                                )}
                              </td>

                              <td className="p-3.5 text-zinc-400 font-mono text-[11px]">
                                {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </td>

                              <td className="p-3.5 pr-5 text-right">
                                <button
                                  onClick={() => handleDeleteLead(lead.id, lead.name, lead.email)}
                                  title="Remover Lead"
                                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SUB TAB 2: CHAT AO VIVO & MODERAÇÃO */}
              {liveSubTab === 'chat' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Left Column: Post Message as Admin */}
                  <div className="bg-[#FFFFFF] border border-zinc-800 rounded-2xl p-5 space-y-4 md:col-span-1">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                      <Send className="h-4 w-4 text-emerald-400" />
                      Enviar Mensagem no Chat
                    </h4>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!adminChatMessage.trim()) return;
                      try {
                        const res = await apiFetch<SyncComment>('/api/real-comments', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: adminChatName || 'Moderador da Live',
                            message: adminChatMessage.trim(),
                            time: 0,
                            photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'
                          })
                        });
                        setRealComments(prev => [...prev.filter(c => c.id !== res.id), res]);
                        setAdminChatMessage('');
                        toast.success('Mensagem enviada no chat!');
                      } catch (err: any) {
                        toast.error('Erro ao enviar', err.message);
                      }
                    }} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-300">Nome de Exibição no Chat</label>
                        <input
                          type="text"
                          value={adminChatName}
                          onChange={(e) => setAdminChatName(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-300">Sua Mensagem</label>
                        <textarea
                          rows={4}
                          placeholder="Digite um aviso, resposta ou orientação para todos os alunos no chat..."
                          value={adminChatMessage}
                          onChange={(e) => setAdminChatMessage(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 rounded-xl text-xs text-white focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={!adminChatMessage.trim()}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Publicar no Chat Ao Vivo
                      </button>
                    </form>

                    <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                      💡 Mensagens enviadas aqui aparecem instantaneamente para todos os participantes na sala ao vivo!
                    </div>
                  </div>

                  {/* Right Column: Live Chat Stream */}
                  <div className="bg-[#FFFFFF] border border-zinc-800 rounded-2xl p-5 space-y-4 md:col-span-2">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-sky-400" />
                        Mensagens do Chat em Tempo Real
                      </h4>
                      {realComments.length > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              await fetch('/api/real-comments/clear', { method: 'POST' });
                              setRealComments([]);
                              toast.success('Chat limpo com sucesso!');
                            } catch (_) {
                              toast.error('Erro ao limpar chat.');
                            }
                          }}
                          className="text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                        >
                          Limpar Chat
                        </button>
                      )}
                    </div>

                    {realComments.length === 0 ? (
                      <div className="text-center py-16 text-zinc-500 text-xs bg-zinc-950/40 rounded-xl border border-dashed border-zinc-800">
                        Nenhuma mensagem enviada pelos participantes no chat até o momento.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                        {realComments.slice().reverse().map((c) => (
                          <div key={c.id} className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80 flex items-start gap-3 group">
                            <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-500/30">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-white">{c.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {formatSecondsToMMSS(c.time)}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteRealComment(c.id)}
                                    title="Excluir mensagem"
                                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-zinc-200 leading-relaxed font-sans">{c.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB TAB 3: PERGUNTAS DOS ALUNOS */}
              {liveSubTab === 'questions' && (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 text-xs text-zinc-400 flex justify-between items-center">
                    <span>Perguntas individuais recebidas através do formulário na sala de transmissão.</span>
                    <span className="font-mono">{questions.length} totais</span>
                  </div>

                  {questions.length === 0 ? (
                    <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-zinc-800/80 text-zinc-500 text-sm">
                      Nenhuma pergunta individual recebida até o momento.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((q) => (
                        <div key={q.id} className="bg-[#FFFFFF] border border-zinc-800 p-5 rounded-2xl space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-white">{q.name}</h4>
                                <span className="text-[10px] text-zinc-400 font-mono">({q.email})</span>
                              </div>
                              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                Enviada em: {new Date(q.createdAt).toLocaleString()}
                              </p>
                            </div>

                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1.5 bg-zinc-950 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
                              title="Deletar pergunta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="bg-zinc-950/40 p-3.5 border border-zinc-900 rounded-lg text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
                            {q.question}
                          </div>

                          {q.answered && q.answer ? (
                            <div className="p-3.5 bg-emerald-500/5 border-l-2 border-emerald-500 rounded text-xs text-zinc-300 font-sans space-y-1">
                              <p className="font-bold text-white flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                Respondido:
                              </p>
                              <p>{q.answer}</p>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Sua resposta de suporte para este aluno..."
                                value={replyText[q.id] || ''}
                                onChange={(e) => setReplyText({ ...replyText, [q.id]: e.target.value })}
                                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                              />
                              <button
                                onClick={() => handleAnswerSubmit(q.id)}
                                disabled={!(replyText[q.id]?.trim())}
                                className="px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              >
                                Enviar Resposta
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* USER PROGRESS LIST TAB */}
          {activeTab === 'users' && (
            <motion.div
              key="users-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-[#FFFFFF] border border-zinc-800 rounded-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-base font-semibold text-white">Auditoria de Progresso de Alunos</h3>
                <span className="text-xs text-zinc-400 font-mono">{userProgressList.length} logs ativos</span>
              </div>

              {userProgressList.length === 0 ? (
                <div className="text-center py-16 text-zinc-500 text-sm">
                  Nenhum registro de progresso de vídeo encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm text-zinc-300">
                    <thead className="bg-zinc-950/40 text-[10px] text-zinc-500 uppercase tracking-widest font-mono border-b border-zinc-800">
                      <tr>
                        <th className="p-4">Estudante</th>
                        <th className="p-4">Tempo Assistido</th>
                        <th className="p-4">Porcentagem</th>
                        <th className="p-4">Último Acesso</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-sans">
                      {userProgressList.map((prog) => {
                        const pct = prog.durationSeconds > 0 ? Math.round((prog.watchedSeconds / prog.durationSeconds) * 100) : 0;
                        return (
                          <tr key={prog.id} className="hover:bg-zinc-950/20 transition-all">
                            <td className="p-4">
                              <p className="font-semibold text-white">{prog.name || 'Sem Nome'}</p>
                              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{prog.email}</p>
                            </td>
                            <td className="p-4 font-mono text-zinc-200">
                              {Math.floor(prog.watchedSeconds / 60)}m {Math.floor(prog.watchedSeconds % 60)}s
                            </td>
                            <td className="p-4 font-mono">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-zinc-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span>{pct}%</span>
                              </div>
                            </td>
                            <td className="p-4 text-zinc-400 text-xs">
                              {new Date(prog.lastAccessTime).toLocaleString()}
                            </td>
                            <td className="p-4 text-center">
                              {prog.completed ? (
                                <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-semibold">
                                  Concluído
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[10px] font-semibold">
                                  Assistindo
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ROOM CONTENT MANAGER TAB */}
          {activeTab === 'content' && (
            <motion.div
              key="content-panel"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Content selectors sub-menu */}
              <div className="flex flex-wrap border-b border-zinc-800 gap-1 pb-1">
                <button
                  onClick={() => setContentTab('comments')}
                  className={`px-4.5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    contentTab === 'comments' ? 'bg-zinc-900 text-white border border-zinc-800/80' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Chat Sincronizado ({comments.length})
                </button>
                <button
                  onClick={() => setContentTab('materials')}
                  className={`px-4.5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    contentTab === 'materials' ? 'bg-zinc-900 text-white border border-zinc-800/80' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Materiais ({materials.length})
                </button>
                <button
                  onClick={() => setContentTab('faq')}
                  className={`px-4.5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    contentTab === 'faq' ? 'bg-zinc-900 text-white border border-zinc-800/80' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  FAQ Accordion ({faq.length})
                </button>
                <button
                  onClick={() => setContentTab('bonuses')}
                  className={`px-4.5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    contentTab === 'bonuses' ? 'bg-zinc-900 text-white border border-zinc-800/80' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Cards de Bônus ({bonuses.length})
                </button>
                <button
                  onClick={() => setContentTab('testimonials')}
                  className={`px-4.5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    contentTab === 'testimonials' ? 'bg-zinc-900 text-white border border-zinc-800/80' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Depoimentos ({testimonials.length})
                </button>
                <button
                  onClick={() => setContentTab('real_comments')}
                  className={`px-4.5 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    contentTab === 'real_comments' ? 'bg-zinc-900 text-white border border-zinc-800/80' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Comentários Reais ({realComments.length})
                </button>
              </div>

              {/* Sub tab details rendering */}
              <div className="bg-[#FFFFFF] border border-zinc-800 p-6 rounded-2xl">
                
                {/* 1. Comments list editor */}
                {contentTab === 'comments' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-white">Comentários Sincronizados com o Vídeo</h4>
                      <button
                        onClick={handleAddComment}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Novo Comentário
                      </button>
                    </div>

                    <div className="space-y-3">
                      {comments.map((com, index) => (
                        <div key={com.id} className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Tempo de exibição (segundos)</label>
                              <input
                                type="number"
                                value={com.time}
                                onChange={(e) => {
                                  const list = [...comments];
                                  list[index].time = parseInt(e.target.value) || 0;
                                  setComments(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Nome Autor</label>
                              <input
                                type="text"
                                value={com.name}
                                onChange={(e) => {
                                  const list = [...comments];
                                  list[index].name = e.target.value;
                                  setComments(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Mensagem do Comentário</label>
                              <input
                                type="text"
                                value={com.message}
                                onChange={(e) => {
                                  const list = [...comments];
                                  list[index].message = e.target.value;
                                  setComments(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                const filtered = comments.filter(c => c.id !== com.id);
                                setComments(filtered);
                                handleSaveComments(filtered);
                              }}
                              className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                            <button
                              onClick={() => handleSaveComments(comments)}
                              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                            >
                              Salvar Linha
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Materials list editor */}
                {contentTab === 'materials' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-white">Materiais de Apoio (Downloads)</h4>
                      <button
                        onClick={handleAddMaterial}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Material
                      </button>
                    </div>

                    <div className="space-y-3">
                      {materials.map((mat, index) => (
                        <div key={mat.id} className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Título</label>
                              <input
                                type="text"
                                value={mat.title}
                                onChange={(e) => {
                                  const list = [...materials];
                                  list[index].title = e.target.value;
                                  setMaterials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Tipo</label>
                              <select
                                value={mat.type}
                                onChange={(e) => {
                                  const list = [...materials];
                                  list[index].type = e.target.value as any;
                                  setMaterials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              >
                                <option value="PDF">PDF</option>
                                <option value="Planilha">Planilha</option>
                                <option value="Checklist">Checklist</option>
                                <option value="Link">Link Externo</option>
                              </select>
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">URL do Recurso / Link</label>
                              <input
                                type="text"
                                value={mat.url}
                                onChange={(e) => {
                                  const list = [...materials];
                                  list[index].url = e.target.value;
                                  setMaterials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-4">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Descrição Curta</label>
                              <input
                                type="text"
                                value={mat.description || ''}
                                onChange={(e) => {
                                  const list = [...materials];
                                  list[index].description = e.target.value;
                                  setMaterials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                const filtered = materials.filter(m => m.id !== mat.id);
                                setMaterials(filtered);
                                handleSaveMaterials(filtered);
                              }}
                              className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                            <button
                              onClick={() => handleSaveMaterials(materials)}
                              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                            >
                              Salvar Linha
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. FAQ list editor */}
                {contentTab === 'faq' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-white">Perguntas Frequentes (FAQ)</h4>
                      <button
                        onClick={handleAddFAQ}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar FAQ
                      </button>
                    </div>

                    <div className="space-y-3">
                      {faq.map((item, index) => (
                        <div key={item.id} className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Ordem</label>
                              <input
                                type="number"
                                value={item.order}
                                onChange={(e) => {
                                  const list = [...faq];
                                  list[index].order = parseInt(e.target.value) || 0;
                                  setFaq(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-4">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Pergunta</label>
                              <input
                                type="text"
                                value={item.question}
                                onChange={(e) => {
                                  const list = [...faq];
                                  list[index].question = e.target.value;
                                  setFaq(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-semibold"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-5">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Resposta</label>
                              <textarea
                                rows={2}
                                value={item.answer}
                                onChange={(e) => {
                                  const list = [...faq];
                                  list[index].answer = e.target.value;
                                  setFaq(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                const filtered = faq.filter(f => f.id !== item.id);
                                setFaq(filtered);
                                handleSaveFAQ(filtered);
                              }}
                              className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                            <button
                              onClick={() => handleSaveFAQ(faq)}
                              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                            >
                              Salvar Linha
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Bonuses list editor */}
                {contentTab === 'bonuses' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-white">Cards de Bônus Únicos</h4>
                      <button
                        onClick={handleAddBonus}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Bônus
                      </button>
                    </div>

                    <div className="space-y-3">
                      {bonuses.map((bon, index) => (
                        <div key={bon.id} className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Título do Bônus</label>
                              <input
                                type="text"
                                value={bon.title}
                                onChange={(e) => {
                                  const list = [...bonuses];
                                  list[index].title = e.target.value;
                                  setBonuses(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Preço/Valor original</label>
                              <input
                                type="text"
                                value={bon.value}
                                onChange={(e) => {
                                  const list = [...bonuses];
                                  list[index].value = e.target.value;
                                  setBonuses(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">URL da Imagem de Banner</label>
                              <input
                                type="text"
                                value={bon.imageUrl || ''}
                                onChange={(e) => {
                                  const list = [...bonuses];
                                  list[index].imageUrl = e.target.value;
                                  setBonuses(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-3">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Descrição Curta</label>
                              <textarea
                                rows={2}
                                value={bon.description}
                                onChange={(e) => {
                                  const list = [...bonuses];
                                  list[index].description = e.target.value;
                                  setBonuses(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                const filtered = bonuses.filter(b => b.id !== bon.id);
                                setBonuses(filtered);
                                handleSaveBonuses(filtered);
                              }}
                              className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                            <button
                              onClick={() => handleSaveBonuses(bonuses)}
                              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                            >
                              Salvar Linha
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Testimonials list editor */}
                {contentTab === 'testimonials' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-white">Depoimentos dos Alunos</h4>
                      <button
                        onClick={handleAddTestimonial}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar Depoimento
                      </button>
                    </div>

                    <div className="space-y-3">
                      {testimonials.map((test, index) => (
                        <div key={test.id} className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Nome</label>
                              <input
                                type="text"
                                value={test.name}
                                onChange={(e) => {
                                  const list = [...testimonials];
                                  list[index].name = e.target.value;
                                  setTestimonials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-semibold"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Estrelas (1-5)</label>
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={test.rating}
                                onChange={(e) => {
                                  const list = [...testimonials];
                                  list[index].rating = parseInt(e.target.value) || 5;
                                  setTestimonials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">URL da Imagem do Avatar</label>
                              <input
                                type="text"
                                value={test.photoUrl}
                                onChange={(e) => {
                                  const list = [...testimonials];
                                  list[index].photoUrl = e.target.value;
                                  setTestimonials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-mono"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-3">
                              <label className="text-[10px] text-zinc-500 font-mono uppercase">Depoimento Escrito</label>
                              <textarea
                                rows={2}
                                value={test.text}
                                onChange={(e) => {
                                  const list = [...testimonials];
                                  list[index].text = e.target.value;
                                  setTestimonials(list);
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-white font-sans leading-relaxed"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                const filtered = testimonials.filter(t => t.id !== test.id);
                                setTestimonials(filtered);
                                handleSaveTestimonials(filtered);
                              }}
                              className="px-2.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                            <button
                              onClick={() => handleSaveTestimonials(testimonials)}
                              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                            >
                              Salvar Linha
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Real user comments viewer */}
                {contentTab === 'real_comments' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-white">Comentários Reais Enviados por Leads</h4>
                      {realComments.length > 0 && (
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/real-comments/clear', { method: 'POST' });
                              if (res.ok) {
                                setRealComments([]);
                                toast.success('Comentários reais limpos!');
                              }
                            } catch (err) {
                              toast.error('Erro ao limpar comentários reais.');
                            }
                          }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
                        >
                          Limpar Todos
                        </button>
                      )}
                    </div>

                    {realComments.length === 0 ? (
                      <div className="text-center py-12 text-zinc-500 text-sm font-sans bg-zinc-950/20 rounded-xl border border-dashed border-zinc-800">
                        Nenhum lead enviou comentários no chat ainda. Todos os comentários digitados por usuários reais aparecerão aqui.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {realComments.map((com) => (
                          <div key={com.id} className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-900 flex justify-between items-start gap-4">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{com.name}</span>
                                <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                                  Vídeo: {Math.floor(com.time / 60)}m {Math.floor(com.time % 60)}s
                                </span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed font-sans">{com.message}</p>
                            </div>
                            <button
                              onClick={() => handleDeleteRealComment(com.id)}
                              title="Excluir comentário"
                              className="px-2.5 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          )}

          {activeTab === 'admins' && <AdminUsersPanel />}

        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}
