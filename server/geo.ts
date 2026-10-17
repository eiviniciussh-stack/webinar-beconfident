// Geolocation resolver for Viewer IP Addresses

export interface GeoLocation {
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  isp?: string;
  isSimulated?: boolean;
}

// Major Brazilian cities with realistic coordinates for fallback/local IPs
const BRAZIL_LOCATIONS = [
  { city: 'São Paulo', region: 'SP', country: 'Brasil', lat: -23.5505, lng: -46.6333 },
  { city: 'Campinas', region: 'SP', country: 'Brasil', lat: -22.9056, lng: -47.0608 },
  { city: 'Santos', region: 'SP', country: 'Brasil', lat: -23.9608, lng: -46.3336 },
  { city: 'Ribeirão Preto', region: 'SP', country: 'Brasil', lat: -21.1775, lng: -47.8103 },
  { city: 'Rio de Janeiro', region: 'RJ', country: 'Brasil', lat: -22.9068, lng: -43.1729 },
  { city: 'Niterói', region: 'RJ', country: 'Brasil', lat: -22.8833, lng: -43.1036 },
  { city: 'Belo Horizonte', region: 'MG', country: 'Brasil', lat: -19.9167, lng: -43.9345 },
  { city: 'Uberlândia', region: 'MG', country: 'Brasil', lat: -18.9186, lng: -48.2772 },
  { city: 'Curitiba', region: 'PR', country: 'Brasil', lat: -25.4284, lng: -49.2733 },
  { city: 'Londrina', region: 'PR', country: 'Brasil', lat: -23.3045, lng: -51.1696 },
  { city: 'Maringá', region: 'PR', country: 'Brasil', lat: -23.4209, lng: -51.9331 },
  { city: 'Porto Alegre', region: 'RS', country: 'Brasil', lat: -30.0346, lng: -51.2177 },
  { city: 'Caxias do Sul', region: 'RS', country: 'Brasil', lat: -29.1678, lng: -51.1794 },
  { city: 'Florianópolis', region: 'SC', country: 'Brasil', lat: -27.5954, lng: -48.5480 },
  { city: 'Joinville', region: 'SC', country: 'Brasil', lat: -26.3045, lng: -48.8487 },
  { city: 'Brasília', region: 'DF', country: 'Brasil', lat: -15.7975, lng: -47.8919 },
  { city: 'Goiânia', region: 'GO', country: 'Brasil', lat: -16.6869, lng: -49.2648 },
  { city: 'Salvador', region: 'BA', country: 'Brasil', lat: -12.9777, lng: -38.5016 },
  { city: 'Recife', region: 'PE', country: 'Brasil', lat: -8.0476, lng: -34.8770 },
  { city: 'Fortaleza', region: 'CE', country: 'Brasil', lat: -3.7172, lng: -38.5434 },
  { city: 'Manaus', region: 'AM', country: 'Brasil', lat: -3.1190, lng: -60.0217 },
  { city: 'Belém', region: 'PA', country: 'Brasil', lat: -1.4558, lng: -48.4902 },
  { city: 'Natal', region: 'RN', country: 'Brasil', lat: -5.7945, lng: -35.2110 },
  { city: 'João Pessoa', region: 'PB', country: 'Brasil', lat: -7.1195, lng: -34.8450 },
  { city: 'Maceió', region: 'AL', country: 'Brasil', lat: -9.6658, lng: -35.7353 },
  { city: 'Aracaju', region: 'SE', country: 'Brasil', lat: -10.9472, lng: -37.0731 },
  { city: 'Vitória', region: 'ES', country: 'Brasil', lat: -20.3155, lng: -40.3128 },
  { city: 'Cuiabá', region: 'MT', country: 'Brasil', lat: -15.6014, lng: -56.0979 },
  { city: 'Campo Grande', region: 'MS', country: 'Brasil', lat: -20.4697, lng: -54.6201 },
  { city: 'São Luís', region: 'MA', country: 'Brasil', lat: -2.5307, lng: -44.3068 },
  { city: 'Teresina', region: 'PI', country: 'Brasil', lat: -5.0920, lng: -42.8038 },
  { city: 'Porto Velho', region: 'RO', country: 'Brasil', lat: -8.7619, lng: -63.9039 }
];

const ipCache = new Map<string, GeoLocation>();

// Deterministic pseudo-random hash to pick realistic location & jitter for simulated/local keys
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getFallbackLocation(seed: string): GeoLocation {
  const hash = hashString(seed || 'seed');
  const base = BRAZIL_LOCATIONS[hash % BRAZIL_LOCATIONS.length];
  // add small jitter so multiple users in same city don't stack on exact same pixel
  const jitterLat = ((hash % 100) / 100 - 0.5) * 0.15;
  const jitterLng = (((hash >> 3) % 100) / 100 - 0.5) * 0.15;
  return {
    city: base.city,
    region: base.region,
    country: base.country,
    lat: Number((base.lat + jitterLat).toFixed(4)),
    lng: Number((base.lng + jitterLng).toFixed(4)),
    isSimulated: true
  };
}

export async function resolveIp(ip?: string, seedKey?: string): Promise<GeoLocation> {
  const cleanIp = (ip || '').trim();
  const seed = seedKey || cleanIp || 'anonymous';

  if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.') || cleanIp.startsWith('172.16.') || cleanIp.startsWith('fc00:')) {
    return getFallbackLocation(seed);
  }

  if (ipCache.has(cleanIp)) {
    return ipCache.get(cleanIp)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,regionName,city,lat,lon,isp,query`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && typeof data.lat === 'number' && typeof data.lon === 'number') {
        const geo: GeoLocation = {
          city: data.city || 'São Paulo',
          region: data.regionName || 'SP',
          country: data.country || 'Brasil',
          lat: data.lat,
          lng: data.lon,
          isp: data.isp,
          isSimulated: false
        };
        ipCache.set(cleanIp, geo);
        return geo;
      }
    }
  } catch (_) {
    // network timeout or offline
  }

  const fallback = getFallbackLocation(seed);
  ipCache.set(cleanIp, fallback);
  return fallback;
}
