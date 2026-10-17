export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  role?: 'admin' | 'user';
  phone?: string;
  watchedSeconds?: number;
  durationSeconds?: number;
  clickedCta?: boolean;
  ctaClickTime?: string;
  device?: string;
  ip?: string;
}

export interface Settings {
  logoText: string;
  highlightText?: string;
  badgeText?: string;
  logoUrl?: string;
  title: string;
  description: string;
  videoUrl: string;
  ctaType: 'time' | 'percentage';
  ctaTriggerValue: number; // minutes or %
  ctaText: string;
  ctaLink: string;
  primaryColor: string; // hex
  secondaryColor: string; // hex
  offerDuration?: number; // duration of offer countdown in seconds
  liveMinUsers?: number;
  liveMaxUsers?: number;
  isScheduled?: boolean;
  scheduledDateTime?: string;
  offerTitle?: string;
  offerBtnText?: string;
  tabOfferTitle?: string;
  tabOfferSubtitle?: string;
  tabOfferDescription?: string;
  webhookUrl?: string;
  webhookEnabled?: boolean;
  isLiveActive?: boolean;
}

export interface SyncComment {
  id: string;
  time: number; // in seconds
  name: string;
  photoUrl: string;
  message: string;
}

export interface UserQuestion {
  id: string;
  userId?: string;
  name: string;
  email: string;
  question: string;
  createdAt: string;
  answered: boolean;
  answer?: string;
}

export interface Material {
  id: string;
  title: string;
  type: 'PDF' | 'Planilha' | 'Checklist' | 'Link';
  url: string;
  description?: string;
}

export interface Bonus {
  id: string;
  title: string;
  description: string;
  value: string; // e.g. "R$ 497" or "Grátis"
  imageUrl?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface Testimonial {
  id: string;
  name: string;
  photoUrl: string;
  text: string;
  rating: number; // 1 to 5
}

export interface UserProgress {
  id: string;
  userId: string;
  name: string;
  email: string;
  watchedSeconds: number;
  durationSeconds: number;
  lastAccessTime: string;
  completed: boolean;
  clickedCta?: boolean;
  ctaClickTime?: string;
  device?: string;
  ip?: string;
}

export interface LeadInfo {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  watchedSeconds: number;
  durationSeconds: number;
  completed: boolean;
  clickedCta: boolean;
  ctaClickTime?: string;
  lastAccessTime?: string;
  isOnline?: boolean;
  device?: string;
  ip?: string;
}

export interface WebinarStats {
  totalUsers: number;
  activeUsers: number;
  peakUsers?: number;
  avgWatchTime: number; // in seconds
  questionsCount: number;
  ctaClicks: number;
}

export interface GeoViewer {
  id: string;
  name: string;
  email?: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  device: 'desktop' | 'mobile' | 'tablet';
  isOnline: boolean;
  isReal: boolean;
  lastPing: number;
  watchedSeconds?: number;
  clickedCta?: boolean;
}

export interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  tablet: number;
  desktopPct: number;
  mobilePct: number;
  tabletPct: number;
}

export interface LiveAnalyticsMapData {
  totalActive: number;
  peakActive: number;
  devices: DeviceBreakdown;
  locationsCount: number;
  viewers: GeoViewer[];
  timestamp: string;
}

// ===== Webinars (salas) =====
export type WebinarType = 'unico' | 'jit';

export interface Webinar {
  id: string;
  type: WebinarType;
  name: string;          // nome interno (só admins veem)
  title: string;         // título mostrado na sala
  slug: string;          // final do link: /w/<slug>
  description?: string;
  videoUrl: string;
  startAt?: string;      // ISO — início da sessão (único)
  durationMinutes?: number;
  endAt?: string;        // ISO — calculado: início + duração
  isActive: boolean;     // pausar/despausar sem apagar
  createdAt: string;
  updatedAt?: string;
}

// ===== Atendimento (suporte individual em tempo real) =====
export interface SupportMessage {
  id: string;
  from: 'lead' | 'agent';
  name: string;
  text: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  kind: 'ticket';
  webinarId: string;
  leadEmail: string;
  leadName: string;
  status: 'open' | 'assigned' | 'closed';
  assignedTo?: string;
  closedBy?: string;
  dismissed?: boolean;
  messages: SupportMessage[];
  unreadForAgent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportRoom {
  webinar: Webinar;
  live: boolean;
  viewers: number;
  agents: number;
  waiting: number;
}
