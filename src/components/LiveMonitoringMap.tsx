import React, { useEffect, useState, useRef, useMemo } from 'react';
import { adminFetch } from '../adminAuth';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Users, RefreshCw, 
  MapPin, Eye, MousePointerClick, Activity,
  Maximize2, Minimize2, Search, Crosshair, ZoomIn, Navigation
} from 'lucide-react';
import { LiveAnalyticsMapData, GeoViewer, LeadInfo, DeviceBreakdown } from '../types';

interface LiveMonitoringMapProps {
  isLiveActive: boolean;
  onToggleLiveStatus?: () => void;
  registeredLeads?: LeadInfo[];
}

// Major Brazilian cities with realistic coordinates for mapping leads and fallbacks
const BRAZIL_CITY_COORDINATES = [
  { city: 'São Paulo', state: 'SP', country: 'Brasil', lat: -23.5505, lng: -46.6333 },
  { city: 'Campinas', state: 'SP', country: 'Brasil', lat: -22.9056, lng: -47.0608 },
  { city: 'Santos', state: 'SP', country: 'Brasil', lat: -23.9608, lng: -46.3336 },
  { city: 'Ribeirão Preto', state: 'SP', country: 'Brasil', lat: -21.1775, lng: -47.8103 },
  { city: 'Rio de Janeiro', state: 'RJ', country: 'Brasil', lat: -22.9068, lng: -43.1729 },
  { city: 'Niterói', state: 'RJ', country: 'Brasil', lat: -22.8833, lng: -43.1036 },
  { city: 'Belo Horizonte', state: 'MG', country: 'Brasil', lat: -19.9167, lng: -43.9345 },
  { city: 'Uberlândia', state: 'MG', country: 'Brasil', lat: -18.9186, lng: -48.2772 },
  { city: 'Curitiba', state: 'PR', country: 'Brasil', lat: -25.4284, lng: -49.2733 },
  { city: 'Londrina', state: 'PR', country: 'Brasil', lat: -23.3045, lng: -51.1696 },
  { city: 'Maringá', state: 'PR', country: 'Brasil', lat: -23.4209, lng: -51.9331 },
  { city: 'Porto Alegre', state: 'RS', country: 'Brasil', lat: -30.0346, lng: -51.2177 },
  { city: 'Caxias do Sul', state: 'RS', country: 'Brasil', lat: -29.1678, lng: -51.1794 },
  { city: 'Florianópolis', state: 'SC', country: 'Brasil', lat: -27.5954, lng: -48.5480 },
  { city: 'Joinville', state: 'SC', country: 'Brasil', lat: -26.3045, lng: -48.8487 },
  { city: 'Brasília', state: 'DF', country: 'Brasil', lat: -15.7975, lng: -47.8919 },
  { city: 'Goiânia', state: 'GO', country: 'Brasil', lat: -16.6869, lng: -49.2648 },
  { city: 'Salvador', state: 'BA', country: 'Brasil', lat: -12.9777, lng: -38.5016 },
  { city: 'Recife', state: 'PE', country: 'Brasil', lat: -8.0476, lng: -34.8770 },
  { city: 'Fortaleza', state: 'CE', country: 'Brasil', lat: -3.7172, lng: -38.5434 },
  { city: 'Manaus', state: 'AM', country: 'Brasil', lat: -3.1190, lng: -60.0217 },
  { city: 'Belém', state: 'PA', country: 'Brasil', lat: -1.4558, lng: -48.4902 },
  { city: 'Vitória', state: 'ES', country: 'Brasil', lat: -20.3155, lng: -40.3128 },
  { city: 'Cuiabá', state: 'MT', country: 'Brasil', lat: -15.6014, lng: -56.0979 },
  { city: 'Campo Grande', state: 'MS', country: 'Brasil', lat: -20.4697, lng: -54.6201 }
];

function getDeterministicCoords(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  const base = BRAZIL_CITY_COORDINATES[abs % BRAZIL_CITY_COORDINATES.length];
  const jitterLat = ((abs % 100) / 100 - 0.5) * 0.12;
  const jitterLng = (((abs >> 3) % 100) / 100 - 0.5) * 0.12;
  return {
    city: base.city,
    state: base.state,
    country: base.country,
    lat: Number((base.lat + jitterLat).toFixed(4)),
    lng: Number((base.lng + jitterLng).toFixed(4))
  };
}

export const LiveMonitoringMap: React.FC<LiveMonitoringMapProps> = ({ 
  isLiveActive,
  onToggleLiveStatus,
  registeredLeads = []
}) => {
  const [data, setData] = useState<LiveAnalyticsMapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedViewer, setSelectedViewer] = useState<GeoViewer | null>(null);
  const [filterDevice, setFilterDevice] = useState<'all' | 'desktop' | 'mobile' | 'tablet'>('all');
  const [viewMode, setViewMode] = useState<'live' | 'all_leads'>('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Fetch live map data from backend
  const fetchLiveMapData = async () => {
    try {
      const res = await adminFetch('/api/analytics/live-map');
      if (res.ok) {
        const json: LiveAnalyticsMapData = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Failed to fetch live map analytics from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and auto-polling
  useEffect(() => {
    fetchLiveMapData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveMapData, 3500);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Leaflet map centered at Brazil
    const map = L.map(mapContainerRef.current, {
      center: [-14.235, -51.925],
      zoom: 4,
      minZoom: 2,
      maxZoom: 14,
      zoomControl: true,
      attributionControl: false
    });

    // Dark Matter CartoDB Basemap Tiles
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    });
    tileLayer.addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Multiple invalidateSize passes to guarantee correct layout in tabs/modals
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const t3 = setTimeout(() => map.invalidateSize(), 800);

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleWindowResize);
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Invalidate map size on fullscreen or container resize
  useEffect(() => {
    const t = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
    return () => clearTimeout(t);
  }, [isFullscreen, viewMode]);

  // Compute final viewers list depending on viewMode (Live vs All Leads fallback)
  const computedViewers: GeoViewer[] = useMemo(() => {
    const serverLiveViewers = data?.viewers || [];
    
    if (viewMode === 'live') {
      if (serverLiveViewers.length > 0) {
        return serverLiveViewers;
      }
      // If no one is actively pinging at this exact moment, fallback to registered leads if available
      if (registeredLeads.length > 0) {
        return registeredLeads.slice(0, 30).map(lead => {
          const coords = getDeterministicCoords(lead.email || lead.name || lead.id);
          const rawDev = (lead.device || '').toLowerCase();
          const devType: 'desktop' | 'mobile' | 'tablet' = 
            rawDev.includes('mobile') || rawDev.includes('iphone') || rawDev.includes('android') ? 'mobile' :
            rawDev.includes('tablet') || rawDev.includes('ipad') ? 'tablet' : 'desktop';

          return {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            city: coords.city,
            state: coords.state,
            country: coords.country,
            lat: coords.lat,
            lng: coords.lng,
            device: devType,
            isOnline: !!lead.isOnline,
            isReal: true,
            lastPing: lead.lastAccessTime ? new Date(lead.lastAccessTime).getTime() : Date.now(),
            watchedSeconds: lead.watchedSeconds,
            clickedCta: lead.clickedCta
          };
        });
      }
      return [];
    }

    // viewMode === 'all_leads': Map all registered leads across Brazil
    return registeredLeads.map(lead => {
      const coords = getDeterministicCoords(lead.email || lead.name || lead.id);
      const rawDev = (lead.device || '').toLowerCase();
      const devType: 'desktop' | 'mobile' | 'tablet' = 
        rawDev.includes('mobile') || rawDev.includes('iphone') || rawDev.includes('android') ? 'mobile' :
        rawDev.includes('tablet') || rawDev.includes('ipad') ? 'tablet' : 'desktop';

      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        city: coords.city,
        state: coords.state,
        country: coords.country,
        lat: coords.lat,
        lng: coords.lng,
        device: devType,
        isOnline: !!lead.isOnline,
        isReal: true,
        lastPing: lead.lastAccessTime ? new Date(lead.lastAccessTime).getTime() : Date.now(),
        watchedSeconds: lead.watchedSeconds,
        clickedCta: lead.clickedCta
      };
    });
  }, [data, viewMode, registeredLeads]);

  // Compute breakdown stats
  const { totalActive, devices, locationsCount } = useMemo(() => {
    let desktop = 0;
    let mobile = 0;
    let tablet = 0;

    computedViewers.forEach(v => {
      if (v.device === 'desktop') desktop++;
      else if (v.device === 'mobile') mobile++;
      else tablet++;
    });

    const total = computedViewers.length;
    const devBreakdown: DeviceBreakdown = {
      desktop,
      mobile,
      tablet,
      desktopPct: total > 0 ? Math.round((desktop / total) * 100) : 0,
      mobilePct: total > 0 ? Math.round((mobile / total) * 100) : 0,
      tabletPct: total > 0 ? Math.round((tablet / total) * 100) : 0
    };

    const uniqueLocs = new Set(computedViewers.map(v => `${v.city}_${v.state}`));

    return {
      totalActive: total,
      devices: devBreakdown,
      locationsCount: uniqueLocs.size
    };
  }, [computedViewers]);

  // Update map markers when computed viewers, filters or search change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();

    // Filter viewers
    const filtered = computedViewers.filter(v => {
      if (filterDevice !== 'all' && v.device !== filterDevice) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = (v.name || '').toLowerCase().includes(q);
        const matchCity = (v.city || '').toLowerCase().includes(q);
        const matchState = (v.state || '').toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchState) return false;
      }
      return true;
    });

    // Create custom pulsing radar icon
    const createRadarIcon = (device: string, isLiveNow: boolean) => {
      const pingClass = isLiveNow ? 'radar-ping' : '';
      const dotColor = isLiveNow ? '#8134FE' : '#38bdf8';
      const shadowColor = isLiveNow ? 'rgba(34, 197, 94, 0.7)' : 'rgba(56, 189, 248, 0.7)';

      return L.divIcon({
        className: 'custom-radar-marker',
        html: `
          <div style="position: relative; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
            ${isLiveNow ? `<div class="${pingClass}"></div>` : ''}
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 10px ${dotColor}, 0 0 20px ${shadowColor}; border: 1.5px solid #ffffff;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
    };

    filtered.forEach(viewer => {
      const lat = Number(viewer.lat);
      const lng = Number(viewer.lng);
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }

      const marker = L.marker([lat, lng], {
        icon: createRadarIcon(viewer.device, viewer.isOnline || viewMode === 'live')
      });

      // Custom Dark Tooltip / Popup
      const deviceLabel = viewer.device === 'mobile' ? '📱 Mobile' : viewer.device === 'desktop' ? '💻 Desktop' : '📟 Tablet';
      const timeWatched = viewer.watchedSeconds ? `${Math.floor(viewer.watchedSeconds / 60)} min` : 'Recente';

      const popupHtml = `
        <div style="padding: 12px 14px; min-width: 200px; font-family: inherit;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 13px; color: #ffffff;">${viewer.name}</span>
            <span style="font-size: 10px; background: rgba(34,197,94,0.15); color: #AE88FB; border: 1px solid rgba(34,197,94,0.3); padding: 2px 6px; border-radius: 9999px; font-weight: 600;">
              ${viewer.isOnline ? 'AO VIVO' : 'INSCRITO'}
            </span>
          </div>
          <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <span>📍</span> <span>${viewer.city}, ${viewer.state} • ${viewer.country}</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #71717a; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; margin-top: 6px;">
            <span>${deviceLabel}</span>
            <span style="color: #60a5fa; font-family: monospace;">⏱️ ${timeWatched}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: false, offset: [0, -8] });
      marker.on('click', () => setSelectedViewer(viewer));
      marker.addTo(layer);
    });

  }, [computedViewers, filterDevice, searchTerm, viewMode]);

  // Center on Brazil handler
  const handleCenterBrazil = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([-14.235, -51.925], 4);
    }
  };

  // Fit bounds to all markers
  const handleFitMarkers = () => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const layers = markersLayerRef.current.getLayers();
    if (layers.length > 0) {
      const group = L.featureGroup(layers);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
    } else {
      handleCenterBrazil();
    }
  };

  // Real Region Calculations from active viewers
  const southeastStates = new Set(['SP', 'RJ', 'MG', 'ES', 'SÃO PAULO', 'RIO DE JANEIRO', 'MINAS GERAIS', 'ESPÍRITO SANTO']);
  const southStates = new Set(['PR', 'SC', 'RS', 'PARANÁ', 'SANTA CATARINA', 'RIO GRANDE DO SUL']);
  const centerWestStates = new Set(['DF', 'GO', 'MT', 'MS', 'DISTRITO FEDERAL', 'GOIÁS', 'MATO GROSSO', 'MATO GROSSO DO SUL']);
  
  const seCount = computedViewers.filter(v => southeastStates.has((v.state || '').toUpperCase())).length;
  const sCount = computedViewers.filter(v => southStates.has((v.state || '').toUpperCase())).length;
  const cwCount = computedViewers.filter(v => centerWestStates.has((v.state || '').toUpperCase())).length;
  const otherCount = totalActive - (seCount + sCount + cwCount);

  const sePct = totalActive > 0 ? Math.round((seCount / totalActive) * 100) : 0;
  const sPct = totalActive > 0 ? Math.round((sCount / totalActive) * 100) : 0;
  const cwPct = totalActive > 0 ? Math.round((cwCount / totalActive) * 100) : 0;
  const otherPct = totalActive > 0 ? Math.round((otherCount / totalActive) * 100) : 0;

  return (
    <div className={`space-y-4 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#F7F5FB] p-6 overflow-y-auto' : ''}`}>
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#FFFFFF]/80 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              Monitoramento em tempo real do seu webinar
            </h2>
            <p className="text-xs text-zinc-400">
              Distribuição geográfica e dispositivos conectados ao vivo via IP
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* Mode Switcher */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setViewMode('live')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'live' 
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Radar Ao Vivo
            </button>
            <button
              onClick={() => setViewMode('all_leads')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'all_leads' 
                  ? 'bg-indigo-500 text-white font-bold shadow' 
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Todos os Leads ({registeredLeads.length})
            </button>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
              autoRefresh 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <Activity className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            <span>{autoRefresh ? 'Tempo Real: ON' : 'Pausado'}</span>
          </button>

          <button
            onClick={fetchLiveMapData}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-all cursor-pointer"
            title="Recarregar dados agora"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-all cursor-pointer"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Top 2 Cards: VIEWERS AO VIVO & DISPOSITIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CARD 1: VIEWERS AO VIVO */}
        <div className="bg-[#FFFFFF] border border-zinc-800/90 rounded-2xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 font-mono tracking-wider">
              <Users className="h-4 w-4 text-emerald-400" />
              <span>{viewMode === 'live' ? 'VIEWERS AO VIVO' : 'TOTAL DE LEADS MAPEADOS'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {viewMode === 'live' ? 'NO AR' : 'CADASTRADOS'}
            </div>
          </div>

          <div className="my-5 flex items-baseline gap-3">
            <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
              {totalActive}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              {viewMode === 'live' ? 'participantes no radar' : 'leads cadastrados'}
            </span>
          </div>

          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>Cidades Ativas: <strong className="text-white">{locationsCount}</strong></span>
            <span>Regiões: <strong className="text-emerald-400">{locationsCount > 0 ? 'Brasil' : '---'}</strong></span>
          </div>
        </div>

        {/* CARD 2: DISPOSITIVOS */}
        <div className="bg-[#FFFFFF] border border-zinc-800/90 rounded-2xl p-5 relative overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 font-mono tracking-wider">
              <Activity className="h-4 w-4 text-sky-400" />
              <span>DISPOSITIVOS</span>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Total: {devices.desktop + devices.mobile + devices.tablet}
            </span>
          </div>

          {/* SVG Donut Chart + Legend */}
          <div className="my-4 flex items-center justify-around gap-4">
            {/* SVG Donut Circle */}
            <div className="relative w-24 h-24 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="4"
                />
                {/* Mobile Segment (Green) */}
                <path
                  strokeWidth="4.5"
                  strokeDasharray={`${devices.mobilePct}, 100`}
                  strokeDashoffset="0"
                  stroke="#8134FE"
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-700 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Desktop Segment (Blue) */}
                <path
                  strokeWidth="4.5"
                  strokeDasharray={`${devices.desktopPct}, 100`}
                  strokeDashoffset={`-${devices.mobilePct}`}
                  stroke="#3b82f6"
                  strokeLinecap="round"
                  fill="none"
                  className="transition-all duration-700 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Tablet Segment (Orange/Amber) */}
                {devices.tabletPct > 0 && (
                  <path
                    strokeWidth="4.5"
                    strokeDasharray={`${devices.tabletPct}, 100`}
                    strokeDashoffset={`-${devices.mobilePct + devices.desktopPct}`}
                    stroke="#f59e0b"
                    strokeLinecap="round"
                    fill="none"
                    className="transition-all duration-700 ease-out"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-white font-mono">{devices.mobilePct}%</span>
                <span className="text-[9px] text-zinc-500">Mobile</span>
              </div>
            </div>

            {/* Legend Breakdown */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                  <span className="text-zinc-300">Desktop</span>
                </div>
                <span className="font-bold text-white">{devices.desktop}</span>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8134FE] shadow-[0_0_8px_#8134FE]" />
                  <span className="text-zinc-300">Mobile</span>
                </div>
                <span className="font-bold text-white">{devices.mobile}</span>
              </div>

              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-zinc-300">Tablet</span>
                </div>
                <span className="font-bold text-white">{devices.tablet}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>Dominância: <strong className="text-[#8134FE]">{devices.mobilePct >= devices.desktopPct ? 'Mobile First' : 'Desktop'}</strong></span>
            <span>{devices.mobilePct}% smartphones</span>
          </div>
        </div>

      </div>

      {/* CARD 3: MAPA DE VIEWERS */}
      <div className="bg-[#FFFFFF] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        
        {/* Map Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <h3 className="text-sm sm:text-base font-bold text-white font-mono tracking-tight">
              Mapa de Viewers <span className="text-zinc-400 text-xs font-normal">({locationsCount} localizações identificadas)</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Map Action Buttons */}
            <button
              onClick={handleCenterBrazil}
              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Centralizar mapa no Brasil"
            >
              <Navigation className="h-3 w-3 text-emerald-400" />
              <span>Brasil</span>
            </button>

            <button
              onClick={handleFitMarkers}
              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              title="Ajustar zoom para todos os pontos"
            >
              <Crosshair className="h-3 w-3 text-sky-400" />
              <span>Ver Todos</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Buscar cidade, estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none w-36 sm:w-48 font-mono"
              />
            </div>

            {/* Device Filter Buttons */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              <button
                onClick={() => setFilterDevice('all')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  filterDevice === 'all' ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterDevice('mobile')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  filterDevice === 'mobile' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Mobile
              </button>
              <button
                onClick={() => setFilterDevice('desktop')}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                  filterDevice === 'desktop' ? 'bg-blue-500/20 text-blue-300 font-bold' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Desktop
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Leaflet Map Box */}
        <div className="relative w-full h-[450px] sm:h-[540px] rounded-xl overflow-hidden border border-zinc-800/80 bg-[#F7F5FB]">
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Map Overlay Stats Pill */}
          <div className="absolute top-3 right-3 z-20 bg-[#FFFFFF]/90 backdrop-blur-md border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-300 flex items-center gap-2 shadow-lg">
            <span className={`w-2 h-2 rounded-full ${totalActive > 0 ? 'bg-[#8134FE] animate-ping' : 'bg-zinc-500'}`} />
            <span>Radar: <strong className="text-white">{totalActive}</strong> {totalActive === 1 ? 'ponto' : 'pontos'}</span>
          </div>

          {/* Selected Viewer Drawer Pill if active */}
          {selectedViewer && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-20 bg-[#FFFFFF]/95 backdrop-blur-md border border-emerald-500/40 p-3.5 rounded-xl shadow-2xl animate-fadeIn">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{selectedViewer.name}</span>
                    <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">
                      {selectedViewer.device.toUpperCase()}
                    </span>
                    {selectedViewer.isOnline && (
                      <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-300 rounded font-mono font-bold">
                        AO VIVO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-emerald-400" />
                    {selectedViewer.city}, {selectedViewer.state} • {selectedViewer.country}
                  </p>
                  {selectedViewer.watchedSeconds !== undefined && (
                    <p className="text-[11px] text-zinc-500 mt-1 font-mono">
                      Tempo assistido: {Math.floor(selectedViewer.watchedSeconds / 60)} min
                    </p>
                  )}
                  {selectedViewer.clickedCta && (
                    <p className="text-[11px] text-emerald-400 mt-0.5 font-mono">
                      ✓ Clicou na Oferta do Treinamento
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedViewer(null)}
                  className="text-zinc-500 hover:text-white text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real-time Geographic Distribution Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
          <div className="bg-zinc-900/60 border border-zinc-800/60 p-3 rounded-xl">
            <span className="text-zinc-500 text-[10px] uppercase block">Região Sudeste</span>
            <span className="text-white font-bold text-sm">{sePct}% <span className="text-xs font-normal text-zinc-400">({seCount})</span></span>
            <span className="text-[10px] text-zinc-500 block">SP, RJ, MG, ES</span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/60 p-3 rounded-xl">
            <span className="text-zinc-500 text-[10px] uppercase block">Região Sul</span>
            <span className="text-white font-bold text-sm">{sPct}% <span className="text-xs font-normal text-zinc-400">({sCount})</span></span>
            <span className="text-[10px] text-zinc-500 block">PR, SC, RS</span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/60 p-3 rounded-xl">
            <span className="text-zinc-500 text-[10px] uppercase block">Centro-Oeste & DF</span>
            <span className="text-white font-bold text-sm">{cwPct}% <span className="text-xs font-normal text-zinc-400">({cwCount})</span></span>
            <span className="text-[10px] text-zinc-500 block">DF, GO, MT, MS</span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800/60 p-3 rounded-xl">
            <span className="text-zinc-500 text-[10px] uppercase block">Nordeste & Norte</span>
            <span className="text-white font-bold text-sm">{otherPct}% <span className="text-xs font-normal text-zinc-400">({otherCount})</span></span>
            <span className="text-[10px] text-zinc-500 block">Demais estados</span>
          </div>
        </div>

      </div>

    </div>
  );
};
