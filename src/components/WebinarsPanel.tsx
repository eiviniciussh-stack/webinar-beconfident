import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, CalendarDays, Copy, Pencil, Trash2, Pause, Play, X, Radio, Settings2, ExternalLink } from 'lucide-react';
import { adminFetch } from '../adminAuth';
import { Webinar } from '../types';
import { useToast } from './Toast';

type Row = Webinar & { status: 'ao_vivo' | 'agendado' | 'encerrado' | 'pausado' };

const C = { ink: '#20044E', ink2: '#4A4060', muted: '#8A8199', line: '#ECE7F5', brand: '#7E2EFF', soft: '#F2EBFF' };

export function youtubeId(url?: string) {
  const m = (url || '').match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|&v=)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function Thumb({ url, title }: { url?: string; title?: string }) {
  const id = youtubeId(url);
  return id ? (
    <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" className="w-full aspect-video object-cover rounded-lg" />
  ) : (
    <div className="w-full aspect-video rounded-lg flex items-center justify-center text-center px-4 text-[#FFFFFF] text-sm font-semibold" style={{ background: 'linear-gradient(135deg,#7E2EFF,#20044E)' }}>
      {title || 'Webinar'}
    </div>
  );
}

export function StatusBadge({ status, type }: { status: string; type?: string }) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    ao_vivo: { label: type === 'jit' ? 'Ao vivo · just in time' : 'Ao vivo', bg: '#DC2626', fg: '#FFFFFF' },
    agendado: { label: 'Agendado', bg: '#F2EBFF', fg: '#6419DB' },
    encerrado: { label: 'Encerrado', bg: '#EEEAF4', fg: '#706680' },
    pausado: { label: 'Pausado', bg: '#EEEAF4', fg: '#706680' },
  };
  const s = map[status] || map.pausado;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: s.bg, color: s.fg }}>
      {status === 'ao_vivo' && <span className="w-1.5 h-1.5 rounded-full bg-[#FFFFFF] animate-pulse" />}
      {s.label}
    </span>
  );
}

const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
export function fmtRange(w: Webinar) {
  if (w.type === 'jit') return 'Sempre disponível: o vídeo começa quando a pessoa entra';
  if (!w.startAt) return 'Sem data';
  const s = new Date(w.startAt);
  const e = w.endAt ? new Date(w.endAt) : null;
  const hh = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}h`;
  const day = (d: Date) => `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  if (!e) return `${day(s)} às ${hh(s)}`;
  return s.toDateString() === e.toDateString() ? `${day(s)} de ${hh(s)} às ${hh(e)}` : `${day(s)} ${hh(s)} a ${day(e)} ${hh(e)}`;
}

const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

interface FormState {
  id?: string;
  name: string;
  title: string;
  slug: string;
  description: string;
  videoUrl: string;
  start: string;
  durationMinutes: number;
  isActive: boolean;
}

const EMPTY: FormState = { name: '', title: '', slug: '', description: '', videoUrl: '', start: '', durationMinutes: 60, isActive: true };

export default function WebinarsPanel({ onOpenMainSettings }: { onOpenMainSettings: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = async () => {
    try {
      const r = await adminFetch('/api/webinars');
      if (r.ok) setRows(await r.json());
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((w) => !s || [w.name, w.title, w.description, w.slug].some((v) => (v || '').toLowerCase().includes(s)));
  }, [rows, q]);

  const linkOf = (w: Webinar) => (w.type === 'jit' ? `${origin}/` : `${origin}/w/${w.slug}`);

  const copy = (w: Webinar) => {
    navigator.clipboard?.writeText(linkOf(w)).then(
      () => toast.success('Link copiado', linkOf(w)),
      () => toast.error('Não foi possível copiar', linkOf(w))
    );
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        title: form.title,
        slug: form.slug || form.name,
        description: form.description,
        videoUrl: form.videoUrl,
        startAt: form.start ? new Date(form.start).toISOString() : undefined,
        durationMinutes: form.durationMinutes,
        isActive: form.isActive,
      };
      const r = await adminFetch(form.id ? `/api/webinars/${form.id}` : '/api/webinars', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || 'Não foi possível salvar.');
      toast.success(form.id ? 'Webinar atualizado' : 'Webinar criado', `Link: ${origin}/w/${json.slug}`);
      setForm(null);
      load();
    } catch (err: any) {
      toast.error('Erro ao salvar', err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (w: Row) => {
    const r = await adminFetch(`/api/webinars/${w.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !w.isActive }),
    });
    if (r.ok) load();
  };

  const remove = async (w: Row) => {
    if (!window.confirm(`Excluir o webinar "${w.name}"? O link deixa de funcionar.`)) return;
    const r = await adminFetch(`/api/webinars/${w.id}`, { method: 'DELETE' });
    if (r.ok) {
      toast.success('Webinar excluído', w.name);
      load();
    }
  };

  const input = 'w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:ring-4 focus:ring-[#8134FE]/10 focus:border-[#8134FE]';
  const inputStyle = { borderColor: C.line, color: C.ink, background: '#FFFFFF' };
  const label = 'block text-xs font-medium mb-1.5';

  return (
    <motion.div key="webinars" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pelo nome do webinar, descrição..." className={`${input} pl-9`} style={inputStyle} />
        </div>
        <button
          onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#FFFFFF] cursor-pointer hover:opacity-90"
          style={{ background: C.brand }}
        >
          <Plus className="h-4 w-4" /> Novo webinar
        </button>
      </div>

      {loading ? (
        <div className="text-sm py-10 text-center" style={{ color: C.muted }}>Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((w) => (
            <div key={w.id} className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: '#FFFFFF', borderColor: C.line }}>
              <Thumb url={w.videoUrl} title={w.title} />
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={w.status} type={w.type} />
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md" style={{ background: C.soft, color: '#6419DB' }}>
                  {w.type === 'jit' ? 'Just in time' : 'Único'}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-xs" style={{ color: C.muted }}>
                <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.brand }} />
                <span>{fmtRange(w)}</span>
              </div>
              <div>
                <div className="font-semibold text-[15px] leading-snug" style={{ color: C.ink }}>{w.name}</div>
                {w.title && w.title !== w.name && <div className="text-xs mt-0.5 line-clamp-2" style={{ color: C.ink2 }}>{w.title}</div>}
              </div>
              <button onClick={() => copy(w)} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 border cursor-pointer text-left" style={{ borderColor: C.line, color: C.ink2 }} title="Copiar link">
                <Copy className="h-3.5 w-3.5 shrink-0" style={{ color: C.brand }} />
                <span className="truncate">{linkOf(w).replace(/^https?:\/\//, '')}</span>
              </button>
              <div className="flex items-center gap-2 mt-auto pt-1">
                {w.type === 'jit' ? (
                  <button onClick={onOpenMainSettings} className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ background: C.soft, color: '#6419DB' }}>
                    <Settings2 className="h-4 w-4" /> Configurar em Vídeos
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setForm({
                          id: w.id,
                          name: w.name,
                          title: w.title,
                          slug: w.slug,
                          description: w.description || '',
                          videoUrl: w.videoUrl,
                          start: toLocalInput(w.startAt),
                          durationMinutes: w.durationMinutes || 60,
                          isActive: w.isActive,
                        })
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium cursor-pointer"
                      style={{ background: C.soft, color: '#6419DB' }}
                    >
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                    <button onClick={() => toggle(w)} title={w.isActive ? 'Pausar' : 'Ativar'} className="p-2 rounded-xl border cursor-pointer" style={{ borderColor: C.line, color: C.ink2 }}>
                      {w.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <a href={linkOf(w)} target="_blank" rel="noreferrer" title="Abrir a sala" className="p-2 rounded-xl border" style={{ borderColor: C.line, color: C.ink2 }}>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button onClick={() => remove(w)} title="Excluir" className="p-2 rounded-xl border cursor-pointer" style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs" style={{ color: C.muted }}>Total de registros: {filtered.length}</div>

      <AnimatePresence>
        {form && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(32,4,78,0.35)' }}>
            <motion.form
              onSubmit={save}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5 shadow-2xl"
              style={{ background: '#FFFFFF' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: C.ink }}>{form.id ? 'Editar webinar' : 'Novo webinar'}</h2>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>Webinar gravado que roda como se fosse ao vivo, num dia e horário marcados.</p>
                </div>
                <button type="button" onClick={() => setForm(null)} className="p-1.5 rounded-lg cursor-pointer" style={{ color: C.muted }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!form.id && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border-2 p-3.5" style={{ borderColor: C.brand, background: '#FBF8FF' }}>
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.ink }}><CalendarDays className="h-4 w-4" style={{ color: C.brand }} /> Webinar único</div>
                    <p className="text-xs mt-1" style={{ color: C.ink2 }}>Uma sessão com data e hora. Quem entra atrasado assiste do ponto em que o vídeo está, como numa live.</p>
                  </div>
                  <div className="rounded-xl border p-3.5" style={{ borderColor: C.line }}>
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.ink }}><Radio className="h-4 w-4" style={{ color: C.muted }} /> Just in time</div>
                    <p className="text-xs mt-1" style={{ color: C.ink2 }}>
                      Já existe: é a <b>Sala principal</b>, ao vivo o tempo todo.{' '}
                      <button type="button" onClick={() => { setForm(null); onOpenMainSettings(); }} className="underline cursor-pointer" style={{ color: C.brand }}>Configurar em Vídeos</button>
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label} style={{ color: C.ink2 }}>Nome do webinar (interno)</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Aula inglês 20/10" className={input} style={inputStyle} />
                </div>
                <div>
                  <label className={label} style={{ color: C.ink2 }}>Título na sala</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Fale inglês com confiança" className={input} style={inputStyle} />
                </div>
              </div>

              <div>
                <label className={label} style={{ color: C.ink2 }}>URL amigável</label>
                <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: C.line }}>
                  <span className="px-3 text-xs whitespace-nowrap" style={{ color: C.muted, background: '#F7F5FB' }}>{origin.replace(/^https?:\/\//, '')}/w/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })}
                    placeholder="aula-ingles-20-10"
                    className="flex-1 px-3 py-2.5 text-sm outline-none"
                    style={{ color: C.ink }}
                  />
                </div>
                <p className="text-[11px] mt-1" style={{ color: C.muted }}>Só letras, números, hífen (-) e underline (_). Se ficar vazio, usamos o nome.</p>
              </div>

              <div>
                <label className={label} style={{ color: C.ink2 }}>Descrição (aparece na página de inscrição)</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} style={inputStyle} />
              </div>

              <div>
                <label className={label} style={{ color: C.ink2 }}>Link do vídeo gravado (YouTube ou arquivo .mp4)</label>
                <input required value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." className={input} style={inputStyle} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className={label} style={{ color: C.ink2 }}>Data e hora de início</label>
                  <input required type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={input} style={inputStyle} />
                </div>
                <div>
                  <label className={label} style={{ color: C.ink2 }}>Duração (minutos)</label>
                  <input required type="number" min={1} max={1440} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} className={input} style={inputStyle} />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: C.ink2 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 accent-[#7E2EFF]" />
                Webinar ativo (o link funciona e aparece em Atendimento)
              </label>

              <p className="text-xs rounded-xl p-3" style={{ background: '#F7F5FB', color: C.ink2 }}>
                Oferta, comentários automáticos, materiais e perguntas frequentes são os mesmos da Sala principal (menu Vídeos e Conteúdos da sala).
              </p>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setForm(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium border cursor-pointer" style={{ borderColor: C.line, color: C.ink2 }}>Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#FFFFFF] cursor-pointer disabled:opacity-60" style={{ background: C.brand }}>
                  {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar webinar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
