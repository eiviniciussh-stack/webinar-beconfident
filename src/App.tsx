import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/Toast';
import LoginScreen from './components/LoginScreen';
import WebinarScreen from './components/WebinarScreen';
import AdminScreen from './components/AdminScreen';
import { Settings, User, SyncComment, FAQItem, Bonus, Testimonial, Material } from './types';
import { Monitor, RefreshCw } from 'lucide-react';
import { roomSlugFromLocation, setRoomId } from './room';
import { Webinar } from './types';

const FALLBACK_SETTINGS: Settings = {
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

const isLocationAdmin = () => {
  try {
    if (typeof window !== 'undefined') {
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      const href = window.location.href.toLowerCase();

      return (
        search.includes('admin') || 
        search.includes('adm') || 
        search.includes('painel') ||
        hash.includes('admin') || 
        hash.includes('adm') || 
        hash.includes('painel') ||
        path.includes('/admin') ||
        path.includes('/painel') ||
        href.includes('admin') ||
        href.includes('painel')
      );
    }
  } catch (e) {
    console.error('Error checking admin route:', e);
  }
  return false;
};

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'webinar' | 'admin'>(() => 
    isLocationAdmin() ? 'admin' : 'login'
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings>(FALLBACK_SETTINGS);
  const [faq, setFaq] = useState<FAQItem[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [syncComments, setSyncComments] = useState<SyncComment[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const roomSlug = roomSlugFromLocation();
  const [roomWebinar, setRoomWebinar] = useState<Webinar | null>(null);
  const [roomError, setRoomError] = useState(false);

  // Rooms created in "Webinars" live at /w/<slug> and override title, video and schedule
  useEffect(() => {
    if (!roomSlug) return;
    const load = () =>
      fetch(`/api/webinars/public/${roomSlug}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((w: Webinar) => {
          setRoomWebinar(w);
          setRoomId(w.id);
          setRoomError(false);
        })
        .catch(() => setRoomError(true));
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [roomSlug]);

  const effectiveSettings: Settings = roomWebinar
    ? {
        ...settings,
        title: roomWebinar.title || settings.title,
        description: roomWebinar.description || settings.description,
        videoUrl: roomWebinar.videoUrl || settings.videoUrl,
        isScheduled: true,
        scheduledDateTime: roomWebinar.startAt,
        isLiveActive: !roomWebinar.endAt || Date.now() <= new Date(roomWebinar.endAt).getTime(),
      }
    : settings;

  const toast = useToast();

  const checkAdminRoute = () => {
    if (isLocationAdmin()) {
      setCurrentScreen('admin');
      return true;
    }
    return false;
  };

  const fetchAppData = async () => {
    try {
      // 1. Settings
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const newSet = await settingsRes.json();
        setSettings((prev) => {
          if (prev && JSON.stringify(prev) === JSON.stringify(newSet)) {
            return prev;
          }
          return newSet;
        });
      }

      // 2. FAQ
      const faqRes = await fetch('/api/faq');
      if (faqRes.ok) setFaq(await faqRes.json());

      // 3. Bonuses
      const bonusesRes = await fetch('/api/bonuses');
      if (bonusesRes.ok) setBonuses(await bonusesRes.json());

      // 4. Materials
      const materialsRes = await fetch('/api/materials');
      if (materialsRes.ok) setMaterials(await materialsRes.json());

      // 5. Testimonials
      const testimonialsRes = await fetch('/api/testimonials');
      if (testimonialsRes.ok) setTestimonials(await testimonialsRes.json());

      // 6. Comments
      const commentsRes = await fetch('/api/comments');
      if (commentsRes.ok) setSyncComments(await commentsRes.json());

    } catch (err) {
      console.error("Hydration error, using fallback settings:", err);
    }
  };

  useEffect(() => {
    fetchAppData();

    // Check if URL specifies Admin immediately
    const isAdmin = checkAdminRoute();

    // Listen to hash and popstate changes
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);

    // Keyboard shortcut to open admin (Alt + A or Ctrl + Shift + A)
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && e.key.toLowerCase() === 'a') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a')) {
        setCurrentScreen((prev) => (prev === 'admin' ? 'login' : 'admin'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Check if there's a stored user credentials and not in admin mode
    if (!isAdmin) {
      const savedName = localStorage.getItem('webinar_user_name');
      const savedEmail = localStorage.getItem('webinar_user_email');
      if (savedName && savedEmail) {
        const localUser: User = {
          id: 'usr_' + btoa(encodeURIComponent(savedEmail)).replace(/=/g, '').slice(0, 10),
          name: savedName,
          email: savedEmail,
          createdAt: new Date().toISOString(),
          role: 'user'
        };
        setCurrentUser(localUser);
        setCurrentScreen('webinar');

        // Re-login in background with timeout
        fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: savedName, email: savedEmail }),
        })
          .then((res) => res.ok ? res.json() : null)
          .then((user: User | null) => {
            if (user) setCurrentUser(user);
          })
          .catch(err => console.warn('Background relogin notice:', err));
      }
    }

    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Periodic polling to propagate admin changes to everyone in real-time (except for the active admin page itself)
  useEffect(() => {
    if (currentScreen === 'admin') return;

    const intervalId = setInterval(() => {
      fetchAppData();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [currentScreen]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('webinar');
  };

  const handleLogout = () => {
    localStorage.removeItem('webinar_user_name');
    localStorage.removeItem('webinar_user_email');
    setCurrentUser(null);
    setCurrentScreen('login');
    toast.info('Sessão encerrada', 'Você saiu da sala do webinar com sucesso.');
  };

  if (roomSlug && roomError && currentScreen !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F2EBFF] text-[#20044E] font-sans px-6 text-center">
        <h1 className="text-2xl font-semibold mb-2">Webinar não encontrado</h1>
        <p className="text-[#706680] max-w-md">Este link não existe ou o webinar foi pausado. Confira o endereço que você recebeu.</p>
      </div>
    );
  }

  if (isInitialLoading || !settings || (roomSlug && !roomWebinar && currentScreen !== 'admin')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#140B26] text-zinc-100 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center animate-spin">
            <RefreshCw className="h-5 w-5" />
          </div>
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Carregando Sala VIP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen overflow-x-hidden transition-colors duration-300 ${currentScreen === 'webinar' || currentScreen === 'login' ? 'bg-white' : 'bg-[#140B26]'}`}>
      {currentScreen === 'login' && (
        <LoginScreen
          settings={effectiveSettings}
          onLoginSuccess={handleLoginSuccess}
          onAdminClick={() => setCurrentScreen('admin')}
        />
      )}

      {currentScreen === 'webinar' && (
        <WebinarScreen
          user={currentUser || {
            id: 'usr_guest_' + Date.now(),
            name: localStorage.getItem('webinar_user_name') || 'Participante VIP',
            email: localStorage.getItem('webinar_user_email') || 'aluno@webinar.com',
            createdAt: new Date().toISOString(),
            role: 'user'
          }}
          settings={effectiveSettings || FALLBACK_SETTINGS}
          faq={faq}
          bonuses={bonuses}
          testimonials={testimonials}
          syncComments={syncComments}
          materials={materials}
          onLogout={handleLogout}
          onAdminClick={() => setCurrentScreen('admin')}
        />
      )}

      {currentScreen === 'admin' && (
        <AdminScreen
          user={currentUser}
          initialSettings={settings || FALLBACK_SETTINGS}
          onSettingsUpdated={(updated) => setSettings(updated)}
          onBack={() => {
            setCurrentScreen(currentUser ? 'webinar' : 'login');
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
