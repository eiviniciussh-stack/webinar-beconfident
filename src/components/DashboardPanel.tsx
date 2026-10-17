import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Users, MousePointerClick, Timer, Radio, Filter, BarChart3, MonitorSmartphone, Info, CalendarDays } from 'lucide-react';
import { LeadInfo, Settings as AppSettings, WebinarStats } from '../types';
import { adminFetch } from '../adminAuth';

// Colors (validated with the dataviz palette checker: categorical PASS on light surface)
const C = {
  ink: '#20044E',
  ink2: '#4A4060',
  muted: '#8A8199',
  line: '#ECE7F5',
  surface: '#FFFFFF',
  brand: '#7E2EFF',
  brandSoft: '#F2EBFF',
  grid: '#F0ECF7',
};
const DEVICE_COLORS: Record<string, string> = { Desktop: '#6D28D9', Mobile: '#0891B2', Tablet: '#F59E0B' };
// Funnel steps: one hue, light -> dark (sequential, magnitude)
const FUNNEL_COLORS = ['#D0BAFD', '#AE88FB', '#9A5CFD', '#7E2EFF', '#5B17C7'];

const dayKey = (d: Date) => {
  const local = new Date(d.getTime() - 3 * 3600_000); // America/Sao_Paulo
  return local.toISOString().slice(0, 10);
};
const fmtDay = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(2).replace('.', ',')}%`;
const fmtDuration = (sec: number) => {
  if (!sec) return '0 min';
  const m = Math.round(sec / 60);
  if (m < 1) return `${Math.round(sec)} s`;
  if (m < 60) return `${m} minuto${m === 1 ? '' : 's'}`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
};
const deviceOf = (d?: string) => {
  const s = (d || '').toLowerCase();
  if (s.includes('tablet') || s.includes('ipad')) return 'Tablet';
  if (s.includes('mobile') || s.includes('iphone') || s.includes('android')) return 'Mobile';
  return 'Desktop';
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string; key?: React.Key }) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ background: C.surface, borderColor: C.line }}>
      {children}
    </div>
  );
}

function CardTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.brandSoft, color: C.brand }}>
        {icon}
      </span>
      <span className="text-sm font-semibold" style={{ color: C.ink }}>{title}</span>
      {hint && (
        <span title={hint} className="cursor-help" style={{ color: C.muted }}>
          <Info className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

interface Props {
  leads: LeadInfo[];
  stats: WebinarStats;
  settings: AppSettings;
}

export default function DashboardPanel({ leads, stats, settings }: Props) {
  const today = dayKey(new Date());
  const [from, setFrom] = useState(() => dayKey(new Date(Date.now() - 14 * 86400_000)));
  const [to, setTo] = useState(today);
  const [visits, setVisits] = useState<Record<string, number>>({});
  const [hoverBar, setHoverBar] = useState<number | null>(null);
  const [hoverDevice, setHoverDevice] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      adminFetch('/api/analytics/visits')
        .then((r) => (r.ok ? r.json() : {}))
        .then((v) => setVisits(v || {}))
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const inRange = (iso?: string) => {
    if (!iso) return false;
    const k = dayKey(new Date(iso));
    return k >= from && k <= to;
  };

  const filtered = useMemo(() => leads.filter((l) => inRange(l.createdAt)), [leads, from, to]);

  const pitchSeconds = settings.ctaType === 'time' ? Number(settings.ctaTriggerValue || 0) : 0;
  const visitsTotal = Object.entries(visits)
    .filter(([k]) => k >= from && k <= to)
    .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  const registered = filtered.length;
  const didWatch = (l: LeadInfo) => (l.watchedSeconds || 0) > 0 || !!l.clickedCta;
  const accessed = filtered.filter(didWatch).length;
  const trigger = Number(settings.ctaTriggerValue || 0);
  const reachedOffer = (l: LeadInfo) => {
    if (l.clickedCta) return true;
    const w = l.watchedSeconds || 0;
    if (settings.ctaType === 'percentage') return l.durationSeconds > 0 && (w / l.durationSeconds) * 100 >= trigger;
    if (pitchSeconds > 0) return w >= pitchSeconds;
    return l.completed;
  };
  const reachedPitch = filtered.filter((l) => didWatch(l) && reachedOffer(l)).length;
  const clicked = filtered.filter((l) => l.clickedCta).length;

  const funnel = [
    { label: 'Visitas', value: Math.max(visitsTotal, registered), hint: 'Pessoas que abriram a página de inscrição' },
    { label: 'Se inscreveu', value: registered, hint: 'Preencheu o formulário e entrou na sala' },
    { label: 'Assistiu à aula', value: accessed, hint: 'Deu play e assistiu pelo menos alguns segundos' },
    { label: 'Chegou na oferta', value: reachedPitch, hint: 'Assistiu até o momento em que a oferta aparece' },
    { label: 'Clicou na oferta', value: clicked, hint: 'Clicou no botão da oferta' },
  ];
  const top = funnel[0].value || 1;

  const watched = filtered.filter((l) => (l.watchedSeconds || 0) > 0);
  const avgWatch = watched.length ? watched.reduce((s, l) => s + (l.watchedSeconds || 0), 0) / watched.length : 0;

  // Participants per day
  const days: string[] = [];
  {
    const start = new Date(from + 'T12:00:00Z');
    const end = new Date(to + 'T12:00:00Z');
    for (let d = start; d <= end && days.length < 120; d = new Date(d.getTime() + 86400_000)) days.push(d.toISOString().slice(0, 10));
  }
  const perDay = days.map((k) => ({ k, v: filtered.filter((l) => dayKey(new Date(l.createdAt)) === k).length }));
  const maxDay = Math.max(1, ...perDay.map((d) => d.v));
  const niceMax = Math.max(4, Math.ceil(maxDay / 4) * 4);

  // Devices
  const deviceCounts = ['Desktop', 'Mobile', 'Tablet'].map((name) => ({
    name,
    v: filtered.filter((l) => deviceOf(l.device) === name).length,
  }));
  const deviceTotal = deviceCounts.reduce((s, d) => s + d.v, 0);

  const kpis = [
    { icon: <Users className="h-4 w-4" />, label: 'Inscritos', value: registered.toLocaleString('pt-BR'), sub: 'Leads no período' },
    { icon: <MousePointerClick className="h-4 w-4" />, label: 'Cliques na oferta', value: clicked.toLocaleString('pt-BR'), sub: `${fmtPct(pct(clicked, registered))} dos inscritos` },
    { icon: <Timer className="h-4 w-4" />, label: 'Tempo médio por sessão', value: fmtDuration(avgWatch), sub: `${watched.length} pessoas assistiram` },
    { icon: <Radio className="h-4 w-4" />, label: 'Ao vivo agora', value: String(stats.activeUsers || 0), sub: `Pico: ${stats.peakUsers || 0}` },
  ];

  // Donut geometry
  const R = 70, STROKE = 26, CIRC = 2 * Math.PI * R;
  let offset = 0;

  return (
    <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" style={{ background: C.surface, borderColor: C.line, color: C.ink2 }}>
          <CalendarDays className="h-4 w-4" style={{ color: C.muted }} />
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="bg-transparent outline-none" style={{ color: C.ink }} />
          <span style={{ color: C.muted }}>até</span>
          <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="bg-transparent outline-none" style={{ color: C.ink }} />
        </div>
        {[7, 15, 30].map((n) => (
          <button
            key={n}
            onClick={() => {
              setFrom(dayKey(new Date(Date.now() - (n - 1) * 86400_000)));
              setTo(today);
            }}
            className="px-3 py-2 rounded-xl text-sm border cursor-pointer hover:opacity-80"
            style={{ background: C.surface, borderColor: C.line, color: C.ink2 }}
          >
            {n} dias
          </button>
        ))}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.brandSoft, color: C.brand }}>{k.icon}</span>
              <span className="text-sm font-medium" style={{ color: C.ink2 }}>{k.label}</span>
            </div>
            <div className="text-[28px] leading-none font-semibold tracking-tight" style={{ color: C.ink }}>{k.value}</div>
            <div className="text-xs mt-2" style={{ color: C.muted }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Funnel */}
      <Card>
        <CardTitle icon={<Filter className="h-4 w-4" />} title="Funil de conversão" hint="Cada etapa mostra quantas pessoas chegaram até ali e a porcentagem sobre as visitas." />
        <div className="grid grid-cols-5 gap-2">
          {funnel.map((f) => (
            <div key={f.label} className="min-w-0">
              <div className="text-xs sm:text-sm truncate" style={{ color: C.ink2 }} title={f.hint}>{f.label}</div>
              <div className="text-lg sm:text-2xl font-semibold" style={{ color: C.ink }}>{f.value.toLocaleString('pt-BR')}</div>
              <div className="text-[11px] sm:text-xs" style={{ color: C.muted }}>{fmtPct(pct(f.value, top))}</div>
            </div>
          ))}
        </div>
        <svg viewBox="0 0 1000 200" className="w-full h-40 mt-4" preserveAspectRatio="none" role="img" aria-label="Funil de conversão">
          {funnel.map((f, i) => {
            const w = 1000 / funnel.length;
            const x0 = i * w + (i ? 2 : 0);
            const x1 = (i + 1) * w - (i < funnel.length - 1 ? 2 : 0);
            const h0 = Math.max(6, (f.value / top) * 190);
            const next = funnel[i + 1] ? funnel[i + 1].value : f.value;
            const h1 = Math.max(6, (next / top) * 190);
            const y0 = 100 - h0 / 2, y1 = 100 - h1 / 2;
            return (
              <path key={f.label} d={`M${x0},${y0} L${x1},${y1} L${x1},${y1 + h1} L${x0},${y0 + h0} Z`} fill={FUNNEL_COLORS[i]}>
                <title>{`${f.label}: ${f.value.toLocaleString('pt-BR')} (${fmtPct(pct(f.value, top))})`}</title>
              </path>
            );
          })}
        </svg>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Participants per day */}
        <Card className="lg:col-span-2">
          <CardTitle icon={<BarChart3 className="h-4 w-4" />} title="Inscritos por dia" hint="Quantidade de novos inscritos em cada dia do período." />
          <div className="relative h-60">
            <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none" onMouseLeave={() => setHoverBar(null)}>
              {[0, 1, 2, 3, 4].map((g) => {
                const y = 210 - (g / 4) * 190;
                return <line key={g} x1="34" x2="600" y1={y} y2={y} stroke={C.grid} strokeWidth="1" />;
              })}
              {perDay.map((d, i) => {
                const slot = 566 / perDay.length;
                const bw = Math.max(2, Math.min(36, slot - 2));
                const x = 34 + i * slot + (slot - bw) / 2;
                const h = (d.v / niceMax) * 190;
                return (
                  <g key={d.k} onMouseEnter={() => setHoverBar(i)}>
                    <rect x={34 + i * slot} y="10" width={slot} height="200" fill="transparent" />
                    {d.v > 0 && (
                      <path
                        d={`M${x},210 L${x},${210 - h + Math.min(4, h)} Q${x},${210 - h} ${x + Math.min(4, bw / 2)},${210 - h} L${x + bw - Math.min(4, bw / 2)},${210 - h} Q${x + bw},${210 - h} ${x + bw},${210 - h + Math.min(4, h)} L${x + bw},210 Z`}
                        fill={hoverBar === null || hoverBar === i ? C.brand : '#C9B2FC'}
                      />
                    )}
                  </g>
                );
              })}
            </svg>
            {/* Y labels */}
            {[0, 1, 2, 3, 4].map((g) => (
              <span key={g} className="absolute left-0 text-[10px] -translate-y-1/2" style={{ top: `${((210 - (g / 4) * 190) / 240) * 100}%`, color: C.muted }}>
                {Math.round((g / 4) * niceMax)}
              </span>
            ))}
            {/* X labels (sparse) */}
            <div className="absolute left-[5.7%] right-0 bottom-0 flex justify-between text-[10px]" style={{ color: C.muted }}>
              {perDay.filter((_, i) => i % Math.max(1, Math.ceil(perDay.length / 8)) === 0).map((d) => (
                <span key={d.k}>{fmtDay(d.k)}</span>
              ))}
            </div>
            {hoverBar !== null && perDay[hoverBar] && (
              <div
                className="absolute top-0 pointer-events-none rounded-lg px-2.5 py-1.5 text-xs shadow-lg border"
                style={{ left: `calc(${((34 + (hoverBar + 0.5) * (566 / perDay.length)) / 600) * 100}% - 40px)`, background: C.surface, borderColor: C.line, color: C.ink }}
              >
                <div style={{ color: C.muted }}>{fmtDay(perDay[hoverBar].k)}</div>
                <div className="font-semibold">{perDay[hoverBar].v} inscrito{perDay[hoverBar].v === 1 ? '' : 's'}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Devices */}
        <Card>
          <CardTitle icon={<MonitorSmartphone className="h-4 w-4" />} title="Dispositivos" hint="Aparelho usado pelos inscritos no período." />
          <div className="flex items-center gap-4">
            <div className="space-y-3 flex-1 min-w-0">
              {deviceCounts.map((d) => (
                <div key={d.name} className="flex items-start gap-2" onMouseEnter={() => setHoverDevice(d.name)} onMouseLeave={() => setHoverDevice(null)}>
                  <span className="w-3 h-3 rounded mt-1 shrink-0" style={{ background: DEVICE_COLORS[d.name] }} />
                  <div>
                    <div className="text-sm font-medium" style={{ color: C.ink }}>
                      {d.name} · {fmtPct(pct(d.v, deviceTotal)).replace(',00', '')}
                    </div>
                    <div className="text-xs" style={{ color: C.muted }}>{d.v}</div>
                  </div>
                </div>
              ))}
            </div>
            <svg viewBox="0 0 180 180" className="w-40 h-40 shrink-0" role="img" aria-label="Dispositivos">
              <circle cx="90" cy="90" r={R} fill="none" stroke={C.grid} strokeWidth={STROKE} />
              {deviceTotal > 0 &&
                deviceCounts.map((d) => {
                  if (!d.v) return null;
                  const len = (d.v / deviceTotal) * CIRC;
                  const gap = deviceCounts.filter((x) => x.v).length > 1 ? 2 : 0;
                  const el = (
                    <circle
                      key={d.name}
                      cx="90"
                      cy="90"
                      r={R}
                      fill="none"
                      stroke={DEVICE_COLORS[d.name]}
                      strokeWidth={hoverDevice === d.name ? STROKE + 4 : STROKE}
                      strokeDasharray={`${Math.max(0, len - gap)} ${CIRC}`}
                      strokeDashoffset={-offset}
                      transform="rotate(-90 90 90)"
                      onMouseEnter={() => setHoverDevice(d.name)}
                      onMouseLeave={() => setHoverDevice(null)}
                    >
                      <title>{`${d.name}: ${d.v} (${fmtPct(pct(d.v, deviceTotal))})`}</title>
                    </circle>
                  );
                  offset += len;
                  return el;
                })}
              {(() => {
                const show = deviceCounts.find((d) => d.name === hoverDevice) || [...deviceCounts].sort((a, b) => b.v - a.v)[0];
                return (
                  <>
                    <text x="90" y="88" textAnchor="middle" fontSize="18" fontWeight="600" fill={C.ink}>
                      {deviceTotal ? `${Math.round(pct(show.v, deviceTotal))}%` : '—'}
                    </text>
                    <text x="90" y="108" textAnchor="middle" fontSize="12" fill={C.muted}>
                      {deviceTotal ? show.name : 'sem dados'}
                    </text>
                  </>
                );
              })()}
            </svg>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
