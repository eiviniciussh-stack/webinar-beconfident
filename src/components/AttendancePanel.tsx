import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Search, CalendarDays, Eye, Headphones, ArrowLeft, Send, MessageCircle, CheckCircle2, Inbox } from 'lucide-react';
import { adminFetch } from '../adminAuth';
import { SupportTicket, Webinar } from '../types';
import { Thumb, StatusBadge, fmtRange } from './WebinarsPanel';
import { useToast } from './Toast';

const C = { ink: '#20044E', ink2: '#4A4060', muted: '#8A8199', line: '#ECE7F5', brand: '#7E2EFF', soft: '#F2EBFF' };

interface RoomCard {
  webinar: Webinar;
  live: boolean;
  status: string;
  viewers: number;
  agents: number;
  waiting: number;
}

interface RoomDetail {
  webinar: Webinar;
  live: boolean;
  me: string;
  viewers: number;
  agents: number;
  tickets: SupportTicket[];
}

type Tab = 'mine' | 'done' | 'waiting';

export default function AttendancePanel() {
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);

  const loadRooms = async () => {
    try {
      const r = await adminFetch('/api/support/rooms');
      if (r.ok) setRooms(await r.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomId) return;
    loadRooms();
    const t = setInterval(loadRooms, 8000);
    return () => clearInterval(t);
  }, [roomId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rooms.filter((r) => !s || [r.webinar.name, r.webinar.title, r.webinar.description].some((v) => (v || '').toLowerCase().includes(s)));
  }, [rooms, q]);

  if (roomId) return <Room id={roomId} onBack={() => setRoomId(null)} />;

  return (
    <motion.div key="attendance" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <div className="relative w-full sm:w-80">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pelo nome do webinar, descrição..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none focus:border-[#8134FE]"
          style={{ borderColor: C.line, color: C.ink, background: '#FFFFFF' }}
        />
      </div>

      {loading ? (
        <div className="text-sm py-10 text-center" style={{ color: C.muted }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center text-sm" style={{ background: '#FFFFFF', borderColor: C.line, color: C.muted }}>
          Nenhum webinar ativo agora. Os webinars aparecem aqui enquanto estão ao vivo ou agendados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <div key={r.webinar.id} className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: '#FFFFFF', borderColor: C.line }}>
              <Thumb url={r.webinar.videoUrl} title={r.webinar.title} />
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={r.status} type={r.webinar.type} />
                <div className="flex items-center gap-3 text-xs" style={{ color: C.muted }}>
                  <span className="inline-flex items-center gap-1" title="Espectadores agora"><Eye className="h-3.5 w-3.5" />{r.viewers}</span>
                  <span className="inline-flex items-center gap-1" title="Atendentes conectados"><Headphones className="h-3.5 w-3.5" />{r.agents}</span>
                </div>
              </div>
              <div className="flex items-start gap-1.5 text-xs" style={{ color: C.muted }}>
                <CalendarDays className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: C.brand }} />
                <span>{fmtRange(r.webinar)}</span>
              </div>
              <div className="font-semibold text-[15px] leading-snug" style={{ color: C.ink }}>{r.webinar.name}</div>
              <button
                onClick={() => setRoomId(r.webinar.id)}
                className="mt-auto relative w-full py-2.5 rounded-xl text-sm font-semibold text-[#FFFFFF] cursor-pointer hover:opacity-90"
                style={{ background: C.brand }}
              >
                Sala de Atendimento
                {r.waiting > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full text-xs leading-6 bg-red-600 text-[#FFFFFF] shadow">{r.waiting}</span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs" style={{ color: C.muted }}>Total de registros: {filtered.length}</div>
    </motion.div>
  );
}

function Room({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<RoomDetail | null>(null);
  const [tab, setTab] = useState<Tab>('waiting');
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const endRef = useRef<HTMLDivElement | null>(null);
  const firstLoad = useRef(true);

  const load = async () => {
    const r = await adminFetch(`/api/support/rooms/${encodeURIComponent(id)}`);
    if (r.ok) {
      const d: RoomDetail = await r.json();
      setData(d);
      if (firstLoad.current) {
        firstLoad.current = false;
        if (d.tickets.some((t) => t.status === 'assigned' && t.assignedTo === d.me)) setTab('mine');
      }
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [id]);

  const me = data?.me || '';
  const lists = useMemo(() => {
    const t = data?.tickets || [];
    return {
      mine: t.filter((x) => x.status === 'assigned' && x.assignedTo === me),
      done: t.filter((x) => x.status === 'closed' && !x.dismissed && (x.closedBy === me || x.assignedTo === me)),
      waiting: t.filter((x) => x.status === 'open'),
    };
  }, [data, me]);

  const current = data?.tickets.find((t) => t.id === selected) || null;
  const canWrite = !!current && current.status !== 'closed' && (current.assignedTo === me || current.status === 'open');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [current?.messages.length, selected]);

  const act = async (ticketId: string, action: 'assign' | 'dismiss' | 'close' | 'read') => {
    setBusy(true);
    try {
      const r = await adminFetch(`/api/support/tickets/${ticketId}/${action}`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Erro');
      if (action === 'assign') {
        setTab('mine');
        setSelected(ticketId);
      }
      if (action === 'close') toast.success('Atendimento finalizado', 'Ele foi para a aba Atendidos.');
      if (action === 'dismiss' && selected === ticketId) setSelected(null);
      await load();
    } catch (err: any) {
      toast.error('Não foi possível concluir', err.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !text.trim()) return;
    const msg = text.trim();
    setText('');
    const r = await adminFetch(`/api/support/tickets/${current.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg }),
    });
    if (!r.ok) {
      setText(msg);
      toast.error('Mensagem não enviada', 'Tente de novo.');
    } else {
      if (tab !== 'mine') setTab('mine');
      load();
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'mine', label: 'Meus atendimentos' },
    { id: 'done', label: 'Atendidos' },
    { id: 'waiting', label: 'Sem atendimento' },
  ];

  const list = lists[tab];
  const last = (t: SupportTicket) => t.messages[t.messages.length - 1];

  return (
    <motion.div key="room" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-xl border cursor-pointer shrink-0" style={{ borderColor: C.line, color: C.ink2, background: '#FFFFFF' }} title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate" style={{ color: C.ink }}>{data?.webinar.name || 'Sala de atendimento'}</div>
            {data && <div className="text-xs" style={{ color: C.muted }}>{data.live ? 'Ao vivo agora' : 'Fora do horário ao vivo'}</div>}
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border px-3 py-2 text-sm" style={{ background: '#FFFFFF', borderColor: C.line, color: C.ink2 }}>
          <span className="inline-flex items-center gap-1.5" title="Espectadores agora"><Eye className="h-4 w-4" style={{ color: C.muted }} />{data?.viewers ?? 0}</span>
          <span className="inline-flex items-center gap-1.5" title="Atendentes conectados"><Headphones className="h-4 w-4" style={{ color: C.muted }} />{data?.agents ?? 1}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:h-[calc(100vh-190px)] min-h-[520px]">
        {/* Left: queues */}
        <div className="lg:col-span-2 rounded-2xl border flex flex-col overflow-hidden" style={{ background: '#FFFFFF', borderColor: C.line }}>
          <div className="p-2 border-b" style={{ borderColor: C.line }}>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F7F5FB' }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 px-2 py-2 rounded-lg text-xs sm:text-[13px] font-medium cursor-pointer"
                  style={tab === t.id ? { background: '#FFFFFF', color: C.ink, boxShadow: '0 1px 3px rgba(32,4,78,0.08)' } : { color: C.muted }}
                >
                  {t.label} <span className="opacity-70">({lists[t.id].length})</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 p-8 text-center text-sm" style={{ color: C.muted }}>
                <Inbox className="h-6 w-6" />
                {tab === 'waiting' ? 'Nenhuma mensagem esperando atendimento.' : tab === 'mine' ? 'Você não está atendendo ninguém agora.' : 'Nenhum atendimento finalizado ainda.'}
              </div>
            ) : (
              list.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelected(t.id);
                    if (t.unreadForAgent && t.assignedTo === me) act(t.id, 'read');
                  }}
                  className="flex items-center gap-3 px-3 py-3 border-b cursor-pointer"
                  style={{ borderColor: C.line, background: selected === t.id ? '#FBF8FF' : 'transparent' }}
                >
                  <span className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-[#FFFFFF] shrink-0" style={{ background: t.unreadForAgent ? '#DC2626' : C.brand }}>
                    {t.unreadForAgent ? t.unreadForAgent : (t.leadName || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.ink }}>
                      <span className="truncate">{t.leadName}</span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-normal" style={{ color: C.muted }}><MessageCircle className="h-3 w-3" />{t.messages.length}</span>
                    </div>
                    <div className="text-xs truncate" style={{ color: C.muted }}>{last(t)?.from === 'agent' ? 'Você: ' : ''}{last(t)?.text}</div>
                  </div>
                  {tab === 'waiting' && (
                    <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button disabled={busy} onClick={() => act(t.id, 'dismiss')} className="px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer" style={{ borderColor: '#FECACA', color: '#DC2626' }}>Dispensar</button>
                      <button disabled={busy} onClick={() => act(t.id, 'assign')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FFFFFF] cursor-pointer" style={{ background: C.ink }}>Atender</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: conversation */}
        <div className="lg:col-span-3 rounded-2xl border flex flex-col overflow-hidden min-h-[420px]" style={{ background: '#FFFFFF', borderColor: C.line }}>
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-sm p-8 text-center" style={{ color: C.muted }}>
              <Headphones className="h-8 w-8" style={{ color: '#D0BAFD' }} />
              Escolha uma conversa à esquerda. Em "Sem atendimento", clique em <b style={{ color: C.ink }}>Atender</b> para assumir.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: C.line }}>
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: C.ink }}>{current.leadName}</div>
                  <div className="text-xs truncate" style={{ color: C.muted }}>
                    {current.leadEmail}
                    {current.assignedTo && current.assignedTo !== me ? ` · atendido por ${current.assignedTo}` : ''}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {current.status === 'open' && (
                    <button disabled={busy} onClick={() => act(current.id, 'assign')} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#FFFFFF] cursor-pointer" style={{ background: C.ink }}>Atender</button>
                  )}
                  {current.status === 'assigned' && current.assignedTo === me && (
                    <button disabled={busy} onClick={() => act(current.id, 'close')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: C.soft, color: '#6419DB' }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Finalizar
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5" style={{ background: '#FBFAFE' }}>
                {current.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === 'agent' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm"
                      style={m.from === 'agent' ? { background: C.brand, color: '#FFFFFF', borderBottomRightRadius: 6 } : { background: '#FFFFFF', color: C.ink, border: `1px solid ${C.line}`, borderBottomLeftRadius: 6 }}
                    >
                      <div className="text-[10px] font-semibold mb-0.5" style={{ opacity: 0.75 }}>{m.from === 'agent' ? m.name : current.leadName}</div>
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <div className="text-[10px] text-right mt-1" style={{ opacity: 0.65 }}>{new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
                {current.status === 'closed' && (
                  <div className="text-center text-xs py-2" style={{ color: C.muted }}>{current.dismissed ? 'Conversa dispensada.' : 'Atendimento finalizado.'}</div>
                )}
                <div ref={endRef} />
              </div>
              <form onSubmit={send} className="flex items-center gap-2 p-3 border-t" style={{ borderColor: C.line }}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={!canWrite}
                  placeholder={canWrite ? 'Escreva sua resposta...' : current.status === 'closed' ? 'Atendimento finalizado' : 'Outra pessoa está atendendo esta conversa'}
                  className="flex-1 px-3.5 py-2.5 rounded-xl border text-sm outline-none focus:border-[#8134FE] disabled:opacity-60"
                  style={{ borderColor: C.line, color: C.ink, background: '#FFFFFF' }}
                />
                <button type="submit" disabled={!canWrite || !text.trim()} className="p-2.5 rounded-xl text-[#FFFFFF] cursor-pointer disabled:opacity-40" style={{ background: C.brand }}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
