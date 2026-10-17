import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, Settings, 
  LogOut, Eye, ShieldCheck, Lock, Radio
} from 'lucide-react';
import { Settings as AppSettings, User, SyncComment, FAQItem, Bonus, Testimonial, UserProgress } from '../types';
import { useToast } from './Toast';
import Chat from './Chat';
import { getRoomId } from '../room';
import BrandHeader, { menuIcons } from './BrandHeader';

interface WebinarScreenProps {
  user: User;
  settings: AppSettings;
  faq: FAQItem[];
  bonuses: Bonus[];
  testimonials: Testimonial[];
  syncComments: SyncComment[];
  materials: any[];
  onLogout: () => void;
  onAdminClick?: () => void;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function getDeviceInfo(): string {
  if (typeof window === 'undefined') return 'Desktop';
  const ua = navigator.userAgent;
  let device = 'Desktop';
  if (/mobile/i.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/i.test(ua)) device = 'Tablet';

  if (/iPhone/i.test(ua)) return 'Mobile (iPhone)';
  if (/Android/i.test(ua) && /mobile/i.test(ua)) return 'Mobile (Android)';
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'Tablet (iPad)';
  if (/Windows/i.test(ua)) return `${device} (Windows)`;
  if (/Macintosh|Mac OS/i.test(ua)) return `${device} (Mac)`;
  if (/Linux/i.test(ua)) return `${device} (Linux)`;
  return device;
}

export default function WebinarScreen({
  user,
  settings,
  faq,
  bonuses,
  testimonials,
  syncComments,
  materials,
  onLogout,
  onAdminClick
}: WebinarScreenProps) {
  const getScheduledState = () => {
    if (!settings.isScheduled || !settings.scheduledDateTime) {
      return { isLiveStarted: true, timeLeft: null };
    }
    const targetTime = new Date(settings.scheduledDateTime).getTime();
    const now = Date.now();
    const diff = targetTime - now;

    if (diff <= 0) {
      return { isLiveStarted: true, timeLeft: null };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      isLiveStarted: false,
      timeLeft: { days, hours, minutes, seconds }
    };
  };

  const [scheduledState, setScheduledState] = useState(() => getScheduledState());

  useEffect(() => {
    if (!settings.isScheduled || !settings.scheduledDateTime) return;

    setScheduledState(getScheduledState());

    const interval = setInterval(() => {
      const nextState = getScheduledState();
      setScheduledState(prev => {
        if (
          prev.isLiveStarted === nextState.isLiveStarted &&
          prev.timeLeft?.days === nextState.timeLeft?.days &&
          prev.timeLeft?.hours === nextState.timeLeft?.hours &&
          prev.timeLeft?.minutes === nextState.timeLeft?.minutes &&
          prev.timeLeft?.seconds === nextState.timeLeft?.seconds
        ) {
          return prev;
        }
        return nextState;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [settings.isScheduled, settings.scheduledDateTime]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  // Sync refs with state
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [showCta, setShowCta] = useState(false);
  const [hasClickedCta, setHasClickedCta] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  const isYouTube = !!getYouTubeId(settings.videoUrl);
  const ytPlayerRef = useRef<any>(null);
  const initialSeekRef = useRef<number>(0);
  const userWatchSecondsRef = useRef<number>(0);
  const hasInitialSeekedRef = useRef<boolean>(false);

  // Load YouTube Player API and initialize
  useEffect(() => {
    if (!scheduledState.isLiveStarted) return;
    if (settings.isLiveActive === false) return;
    if (!isYouTube) return;

    // Load API script if not loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    let interval: NodeJS.Timeout;

    const initPlayer = () => {
      const ytId = getYouTubeId(settings.videoUrl);
      if (!ytId) return;

      // Clean up previous iframe if already exists
      const container = document.getElementById('youtube-player');
      if (!container) return;
      container.innerHTML = ''; // Clear container

      const playerEl = document.createElement('div');
      playerEl.id = 'yt-iframe-placeholder';
      container.appendChild(playerEl);

      ytPlayerRef.current = new (window as any).YT.Player('yt-iframe-placeholder', {
        videoId: ytId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0, // hide controls
          disablekb: 1,
          fs: 1, // enable fullscreen support
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          playsinline: 1,
          cc_load_policy: 0
        },
        events: {
          onReady: (event: any) => {
            setDuration(event.target.getDuration());
            try {
              event.target.mute();
              event.target.playVideo();
            } catch (err) {}
            setIsPlaying(true);

            // Compute exact elapsed time since scheduled start ONCE
            if (!hasInitialSeekedRef.current) {
              let targetSeek = 0;
              if (settings.isScheduled && settings.scheduledDateTime) {
                const startMs = new Date(settings.scheduledDateTime).getTime();
                const elapsed = Math.floor((Date.now() - startMs) / 1000);
                if (elapsed > 0) {
                  targetSeek = elapsed;
                }
              }
              if (targetSeek > 0) {
                event.target.seekTo(targetSeek, true);
                setCurrentTime(targetSeek);
              }
              hasInitialSeekedRef.current = true;
            }
          },
          onStateChange: (event: any) => {
            // PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
            if (event.data === 1 || event.data === 3) {
              setIsPlaying(true);
            } else if (event.data === 2 || event.data === 0) {
              setIsPlaying(false);
            }
          }
        }
      });

      // Poll current playback time smoothly once every second
      interval = setInterval(() => {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          try {
            const current = ytPlayerRef.current.getCurrentTime();
            if (typeof current === 'number') {
              const floorSec = Math.floor(current);
              if (floorSec !== Math.floor(currentTimeRef.current)) {
                setCurrentTime(floorSec);
              }
            }
            const dur = ytPlayerRef.current.getDuration();
            if (typeof dur === 'number' && dur > 0 && dur !== durationRef.current) {
              setDuration(dur);
            }
          } catch (e) {
            // Ignore API state errors
          }
        }
      }, 1000);
    };

    const checkYT = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        setTimeout(checkYT, 100);
      }
    };
    
    checkYT();

    return () => {
      clearInterval(interval);
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, [isYouTube, settings.videoUrl, scheduledState.isLiveStarted, settings.isLiveActive]);

  // DefineChapters for the webinar based on video duration
  const chapters = [
    { title: "Introdução & Alinhamento", start: 0, end: 60 },
    { title: "O Grande Gargalo do Mercado", start: 61, end: 180 },
    { title: "Os 3 Pilares do Método VIP", start: 181, end: 320 },
    { title: "Estudos de Caso & Aplicação", start: 321, end: 450 },
    { title: "Oferta Única de Lançamento", start: 451, end: 99999 }
  ];

  // Active Chapter calculation
  const getActiveChapter = () => {
    return chapters.find(ch => currentTime >= ch.start && currentTime <= ch.end)?.title || "Transmissão";
  };

  // 1. Fetch user progress on mount and track user session watch time
  useEffect(() => {
    if (!scheduledState.isLiveStarted) return;
    const loadSavedProgress = async () => {
      try {
        const response = await fetch('/api/progress');
        if (response.ok) {
          const list: UserProgress[] = await response.json();
          const userRec = list.find(p => p.userId === user.id || (user.email && p.email && p.email.toLowerCase() === user.email.toLowerCase()));
          if (userRec && userRec.watchedSeconds > 0) {
            userWatchSecondsRef.current = userRec.watchedSeconds;
          }
        }
      } catch (err) {
        console.error("Error loading saved progress:", err);
      }
    };
    loadSavedProgress();
  }, [user.id, user.email, scheduledState.isLiveStarted]);

  // Increment user actual watch time every second when live is active and playing
  useEffect(() => {
    if (!scheduledState.isLiveStarted) return;
    if (settings.isLiveActive === false) return;

    const interval = setInterval(() => {
      if (isPlaying) {
        userWatchSecondsRef.current += 1;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledState.isLiveStarted, settings.isLiveActive, isPlaying]);

  // Try to play standard video automatically on mount / url change
  useEffect(() => {
    if (!scheduledState.isLiveStarted) return;
    if (settings.isLiveActive === false) return;
    if (!isYouTube && videoRef.current) {
      if (settings.isScheduled && settings.scheduledDateTime) {
        const startMs = new Date(settings.scheduledDateTime).getTime();
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        if (elapsed > 0 && videoRef.current) {
          videoRef.current.currentTime = elapsed;
          setCurrentTime(elapsed);
        }
      }

      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.log("Auto play on load failed, trying muted:", err);
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(e => console.error(e));
        }
      });
    }
  }, [isYouTube, settings.videoUrl, settings.isScheduled, settings.scheduledDateTime, scheduledState.isLiveStarted, settings.isLiveActive]);

  // 2. Real-time active users counter & keep-alive ping with smooth disconnect on unload
  useEffect(() => {
    const sendPing = async () => {
      try {
        await fetch('/api/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, name: user.name, device: getDeviceInfo(), webinarId: getRoomId() })
        });
      } catch (err) {
        console.error("Ping error:", err);
      }
    };

    const sendOffline = () => {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({ email: user.email })], { type: 'application/json' });
          navigator.sendBeacon('/api/ping/offline', blob);
        } else {
          fetch('/api/ping/offline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
            keepalive: true
          }).catch(() => {});
        }
      } catch (e) {}
    };

    sendPing();
    const interval = setInterval(sendPing, 3000); // Poll every 3s

    window.addEventListener('beforeunload', sendOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', sendOffline);
      sendOffline();
    };
  }, [user.email, user.name]);

  // Real-time active users simulated audience range with custom progression rule:
  // - Starts at 15% of minUsers
  // - First 10 minutes (0 to 600s): increases 5% per minute until reaching 100% of minUsers (NEVER drops)
  // - After 10 minutes (> 600s): fluctuates smoothly and stably between minUsers and maxUsers
  useEffect(() => {
    const min = settings.liveMinUsers !== undefined && settings.liveMinUsers > 0 ? settings.liveMinUsers : 20;
    const max = settings.liveMaxUsers !== undefined && settings.liveMaxUsers > 0 ? settings.liveMaxUsers : 35;
    const realMin = Math.min(min, max);
    const realMax = Math.max(min, max);

    const calculateAudience = (elapsed: number, lastVal: number | null) => {
      if (elapsed <= 600) {
        // Minutes elapsed (0 to 10)
        const minutes = Math.min(10, Math.max(0, elapsed / 60));
        // Starts at 15% (0.15) at min 0, reaches 100% (1.0) at min 10
        const percent = Math.min(1.0, 0.15 + (0.085 * minutes));
        const base = Math.max(1, Math.round(realMin * percent));
        
        // Never drop during the first 10 minutes: strictly increase or hold
        if (lastVal !== null && lastVal > base) {
          return lastVal;
        }
        return base;
      } else {
        // After 10 minutes: fluctuate smoothly between realMin and realMax
        if (realMin === realMax) return realMin;
        const current = (lastVal !== null && lastVal >= realMin && lastVal <= realMax) ? lastVal : realMin;
        
        // High stability: 40% chance +1, 40% chance hold, 20% chance -1
        const rand = Math.random();
        let newVal = current;
        if (rand < 0.40) {
          newVal = current + 1;
        } else if (rand < 0.80) {
          newVal = current;
        } else {
          newVal = current - 1;
        }

        if (newVal < realMin) newVal = realMin;
        if (newVal > realMax) newVal = realMax;
        return newVal;
      }
    };

    setActiveUsers(prev => calculateAudience(currentTimeRef.current, prev));

    const interval = setInterval(() => {
      setActiveUsers(prev => calculateAudience(currentTimeRef.current, prev));
    }, 5000);

    return () => clearInterval(interval);
  }, [settings.liveMinUsers, settings.liveMaxUsers]);

  // 3. Save watched progress automatically using user's actual session watched time
  useEffect(() => {
    const saveProgressToDb = async () => {
      if (settings.isLiveActive === false) return; // Stop saving progress when stream is turned offline
      const watched = userWatchSecondsRef.current;
      const dur = durationRef.current || 1;

      try {
        await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            name: user.name,
            watchedSeconds: watched,
            durationSeconds: dur,
            device: getDeviceInfo()
          })
        });
      } catch (err) {
        console.error("Error saving progress:", err);
      }
    };

    const interval = setInterval(saveProgressToDb, 5000); // Save every 5s
    return () => clearInterval(interval);
  }, [user.id, user.email, user.name, settings.isLiveActive]);

  // 4. SMART CTA evaluation logic
  useEffect(() => {
    if (duration <= 0) return;

    let triggerCta = false;
    if (settings.ctaType === 'time') {
      // settings.ctaTriggerValue is in seconds
      if (currentTime >= settings.ctaTriggerValue) {
        triggerCta = true;
      }
    } else if (settings.ctaType === 'percentage') {
      const percentageWatched = (currentTime / duration) * 100;
      if (percentageWatched >= settings.ctaTriggerValue) {
        triggerCta = true;
      }
    }

    if (triggerCta && !showCta) {
      setShowCta(true);
      toast.success(
        'OFERTA LIBERADA!',
        'Uma oportunidade exclusiva foi disponibilizada abaixo do vídeo!'
      );
    }
  }, [currentTime, duration, settings.ctaType, settings.ctaTriggerValue, showCta]);

  const handleUnmute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMuted(false);
    if (isYouTube && ytPlayerRef.current) {
      try {
        if (typeof ytPlayerRef.current.unMute === 'function') {
          ytPlayerRef.current.unMute();
        }
        if (typeof ytPlayerRef.current.setVolume === 'function') {
          ytPlayerRef.current.setVolume(volume * 100);
        }
      } catch (err) {}
    } else if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume;
    }
  };

  // Handle Video Events
  const handlePlayPause = () => {
    if (isMuted) {
      handleUnmute();
    }

    if (isYouTube && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.playVideo();
      } catch (e) {}
      setIsPlaying(true);
    } else if (videoRef.current) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.error(err));
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.log("Autoplay blocked, playing muted:", err);
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(e => console.error("Muted autoplay failed:", e));
        }
      });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const nextMute = val === 0;
    setIsMuted(nextMute);

    if (isYouTube && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setVolume(nextMute ? 0 : val * 100);
        ytPlayerRef.current.setMuted(nextMute);
      } catch (e) {}
    } else if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = nextMute;
    }
  };

  const handleMuteToggle = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);

    if (isYouTube && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.setMuted(nextMute);
        ytPlayerRef.current.setVolume(nextMute ? 0 : volume * 100);
      } catch (e) {}
    } else if (videoRef.current) {
      videoRef.current.muted = nextMute;
    }
  };

  const handlePlaybackSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  const toggleFullScreen = async () => {
    if (!containerRef.current) return;

    try {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement ||
        isFullScreen
      );

      if (!isFs) {
        if (containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if ((containerRef.current as any).webkitRequestFullscreen) {
          await (containerRef.current as any).webkitRequestFullscreen();
        } else if ((containerRef.current as any).msRequestFullscreen) {
          await (containerRef.current as any).msRequestFullscreen();
        } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          (videoRef.current as any).webkitEnterFullscreen();
        }

        setIsFullScreen(true);

        // Attempt locking orientation to landscape on mobile
        if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullScreen(false);
        if (screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
          try { (screen.orientation as any).unlock(); } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Fullscreen toggle error:", err);
      // Fallback toggle for mobile WebViews or unsupported fullscreen containers
      setIsFullScreen(!isFullScreen);
    }
  };

  // Tracks Fullscreen browser escape keys and vendor state
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullScreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  // Format second counters (e.g. 125 -> 02:05)
  const formatTimeCounter = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * duration;

    if (isYouTube && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try {
        ytPlayerRef.current.seekTo(seekTime, true);
      } catch (e) {}
      setCurrentTime(seekTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleCtaClick = async () => {
    setHasClickedCta(true);
    try {
      await fetch('/api/cta/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, email: user?.email })
      });
    } catch (err) {
      console.error("Error tracking CTA click:", err);
    }
    window.open(settings.ctaLink || '#', '_blank', 'noopener,noreferrer');
  };

  const formatScheduledDate = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateTimeStr;
    }
  };

  if (settings.isLiveActive === false) {
    return (
      <div className="relative min-h-screen bg-[#20044E] text-white font-sans select-none flex flex-col justify-between overflow-hidden">
        {/* Background Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#20044E] via-[#2D1461] to-[#140B26]" />
        </div>

        {/* Header Bar */}
        <header className="relative z-10 w-full border-b border-zinc-800 bg-zinc-950/80 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Transmissão Encerrada</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="px-3.5 py-1.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </header>

        {/* Offline Screen Main Content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-2xl mx-auto space-y-6 my-auto">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shadow-2xl">
            <Radio className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest font-mono">
              🔴 TRANSMISSÃO OFFLINE / ENCERRADA
            </span>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {settings.title || 'Transmissão do Webinar'}
            </h1>
            <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Esta transmissão ao vivo foi encerrada pelo apresentador. Agradecemos imensamente por acompanhar a nossa aula!
            </p>
          </div>

          {/* Offer CTA if CTA link is present */}
          {settings.ctaLink && (
            <div className="w-full max-w-md bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-emerald-950/80 border border-emerald-500/30 p-6 rounded-2xl space-y-4 shadow-2xl">
              <div className="space-y-1">
                <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider block font-mono">
                  {settings.offerTitle || 'Oferta Especial de Encerramento'}
                </span>
                <p className="text-white text-sm font-semibold">
                  {settings.ctaText || 'Garanta sua vaga especial antes do fechamento definitivo!'}
                </p>
              </div>

              <button
                onClick={handleCtaClick}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl cursor-pointer"
              >
                {settings.offerBtnText || 'Garantir Vaga Agora'}
              </button>
            </div>
          )}
        </main>

        <footer className="relative z-10 w-full border-t border-zinc-900 bg-zinc-950 py-4 text-center text-xs text-zinc-600 font-mono">
          Plataforma de Transmissão Ao Vivo • Todos os direitos reservados.
        </footer>
      </div>
    );
  }

  if (!scheduledState.isLiveStarted && scheduledState.timeLeft) {
    const { days, hours, minutes, seconds } = scheduledState.timeLeft;
    return (
      <div className="relative min-h-screen bg-[#20044E] text-white font-sans select-none flex flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#8134FE]/25 blur-3xl" />
        </div>
        <BrandHeader label={settings.logoText} userName={user.name} items={[{ label: 'Sair', icon: menuIcons.logout, onClick: onLogout, danger: true }]} />

        {/* Minimalist Premium Main Content */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-3xl mx-auto space-y-8 my-auto">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#AE88FB] text-xs font-bold uppercase tracking-widest backdrop-blur-md shadow-xl">
            TRANSMISSÃO EXCLUSIVA
          </div>

          {/* Minimalist Title */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight uppercase max-w-2xl drop-shadow-lg">
            {settings.title}
          </h1>

          {/* Premium Countdown Clock */}
          <div className="w-full max-w-2xl space-y-4 pt-2">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
              A transmissão ao vivo começará em:
            </p>

            <div className="grid grid-cols-4 gap-3 sm:gap-4 w-full">
              <div className="bg-white/5 border border-white/10 hover:border-[#8134FE]/50 rounded-2xl p-4 sm:p-6 flex flex-col items-center shadow-2xl backdrop-blur-md transition-all">
                <span className="text-3xl sm:text-5xl font-black text-[#AE88FB] font-mono tracking-tight">{days}</span>
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1">Dias</span>
              </div>
              <div className="bg-white/5 border border-white/10 hover:border-[#8134FE]/50 rounded-2xl p-4 sm:p-6 flex flex-col items-center shadow-2xl backdrop-blur-md transition-all">
                <span className="text-3xl sm:text-5xl font-black text-[#AE88FB] font-mono tracking-tight">
                  {hours.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1">Horas</span>
              </div>
              <div className="bg-white/5 border border-white/10 hover:border-[#8134FE]/50 rounded-2xl p-4 sm:p-6 flex flex-col items-center shadow-2xl backdrop-blur-md transition-all">
                <span className="text-3xl sm:text-5xl font-black text-[#AE88FB] font-mono tracking-tight">
                  {minutes.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1">Minutos</span>
              </div>
              <div className="bg-white/5 border border-white/10 hover:border-[#8134FE]/50 rounded-2xl p-4 sm:p-6 flex flex-col items-center shadow-2xl backdrop-blur-md transition-all">
                <span className="text-3xl sm:text-5xl font-black text-[#AE88FB] font-mono tracking-tight">
                  {seconds.toString().padStart(2, '0')}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider mt-1">Segundos</span>
              </div>
            </div>
          </div>

          {/* Scheduled Date badge */}
          {settings.scheduledDateTime && (
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-5 py-2 text-xs font-semibold text-[#D0BAFD] backdrop-blur-md shadow-lg">
              <span>📅 {formatScheduledDate(settings.scheduledDateTime)}</span>
            </div>
          )}
        </main>

        {/* Minimalist Clean Footer without security badges */}
        <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex justify-center items-center text-xs text-zinc-500">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer text-xs font-medium"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3FF] text-zinc-800 font-sans select-none flex flex-col">
      <BrandHeader
        label={settings.logoText}
        userName={user.name}
        right={
          <span className="hidden sm:inline-flex items-center gap-2 bg-white rounded-2xl px-3.5 py-3 text-xs font-semibold text-[#20044E] shadow-[0_4px_20px_-6px_rgba(45,20,97,0.22)]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Ao vivo
            {activeUsers !== null && activeUsers > 0 && (<span className="flex items-center gap-1 text-[#706680] font-medium"><Eye className="h-3.5 w-3.5" />{activeUsers}</span>)}
          </span>
        }
        items={[{ label: 'Sair da sala', icon: menuIcons.logout, onClick: onLogout, danger: true }]}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-0 sm:px-4 md:px-6 py-2 sm:py-4 lg:py-4 flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-8">
        
        {/* LEFT COLUMN: TITLE & VIDEO CONTAINER (66% on PC, 100% on Mobile) */}
        <section className="lg:col-span-2 flex flex-col gap-4">
          
          {/* Desktop/Tablet Header Title */}
          <h1 className="hidden lg:block text-2xl md:text-3xl font-semibold text-[#20044E] tracking-tight leading-tight px-4 sm:px-0">
            <span className="text-[#8134FE]">[AO VIVO]</span> {settings.title || 'Crie o seu primeiro webinário do zero.'}
          </h1>

          {/* Mobile Header Title (Nome da Aula) */}
          <h1 className="block lg:hidden text-lg font-semibold text-[#20044E] tracking-tight leading-snug px-4 pb-1">
            <span className="text-[#8134FE]">[AO VIVO]</span> {settings.title || 'Crie o seu primeiro webinário do zero.'}
          </h1>

          {/* 16:9 Video Player Container */}
          <div 
            ref={containerRef}
            className={`relative bg-black sm:rounded-[24px] overflow-hidden shadow-[0_24px_60px_-24px_rgba(45,20,97,0.45)] border border-[#ECE4FB] group flex flex-col justify-between aspect-video w-full transition-all ${
              isFullScreen ? 'fixed inset-0 z-[9999] h-screen w-screen border-none rounded-none aspect-auto' : ''
            }`}
          >
            {isYouTube ? (
              <div className="absolute inset-0 w-full h-full">
                {/* Embedded YouTube container */}
                <div id="youtube-player" className="w-full h-full pointer-events-none [&>iframe]:w-full [&>iframe]:h-full" />
                {/* Transparent cover to capture click */}
                <div 
                  onClick={handlePlayPause}
                  className={`absolute inset-0 w-full h-full z-10 bg-transparent ${isPlaying ? 'cursor-default' : 'cursor-pointer'}`}
                />
              </div>
            ) : (
              <video
                ref={videoRef}
                src={settings.videoUrl}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onClick={handlePlayPause}
                className={`w-full h-full object-cover ${isPlaying ? 'cursor-default' : 'cursor-pointer'}`}
                playsInline
                preload="auto"
                autoPlay
                muted={isMuted}
              />
            )}

            {/* Pulsing Unmute overlay if playing but muted */}
            {isPlaying && isMuted && (
              <div 
                onClick={handleUnmute}
                className="absolute inset-0 bg-black/45 hover:bg-black/60 flex flex-col items-center justify-center cursor-pointer z-30 text-white gap-3 p-4 text-center select-none animate-fade-in"
              >
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all text-white">
                  <VolumeX className="h-7 w-7 text-white animate-bounce" />
                </div>
                <div className="space-y-1 bg-black/60 px-4 py-2.5 rounded-xl border border-white/10 backdrop-blur-sm">
                  <p className="text-sm font-black tracking-tight text-white uppercase">
                    O VÍDEO ESTÁ SEM SOM
                  </p>
                  <p className="text-xs text-zinc-200 font-medium">
                    Clique aqui para ativar o áudio da transmissão
                  </p>
                </div>
              </div>
            )}

            {/* Premium "Join Live Class" Overlay */}
            {!isPlaying && (
              <div 
                onClick={handlePlayPause}
                className="absolute inset-0 bg-gradient-to-br from-[#20044E] via-[#2D1461] to-[#140B26] flex flex-col items-center justify-center cursor-pointer z-30 text-white gap-4 p-4 text-center select-none animate-fade-in"
              >
                <div className="w-20 h-20 bg-[#7E2EFF] rounded-full shadow-[0_0_40px_rgba(129,52,254,0.6)] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all text-white">
                  <Play className="h-8 w-8 fill-white pl-1 animate-pulse" />
                </div>
                <div className="space-y-1.5 max-w-sm">
                  <h3 className="font-semibold text-lg sm:text-2xl tracking-tight text-white font-sans">
                    A aula ao vivo começou!
                  </h3>
                  <p className="text-xs sm:text-sm text-[#D0BAFD] font-medium font-sans">
                    Clique para ativar o som e participar da transmissão ao vivo.
                  </p>
                </div>
              </div>
            )}

            {/* Top-left floating badge matching screenshot */}
            <div className="absolute top-3 left-3 z-30 flex items-stretch rounded-md overflow-hidden shadow-md text-[10px] sm:text-xs font-bold select-none tracking-wider font-sans">
              <div className="bg-[#E00] text-white px-2.5 py-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                Ao Vivo
              </div>
              {activeUsers !== null && activeUsers > 0 && (
                <div className="bg-white text-zinc-800 px-2.5 py-1.5 flex items-center gap-1.5 border-l border-zinc-200/50">
                  <Eye className="h-3.5 w-3.5 text-zinc-500" />
                  {activeUsers}
                </div>
              )}
            </div>

            {/* YouTube-Style Fullscreen Icon Button (Bottom Right) */}
            {isPlaying && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullScreen();
                }}
                className="absolute bottom-3 right-3 z-30 p-2 rounded-lg bg-black/70 hover:bg-black text-white border border-white/20 hover:border-white/60 shadow-xl backdrop-blur-sm transition-all cursor-pointer active:scale-90 flex items-center justify-center"
                title={isFullScreen ? "Sair da Tela Cheia" : "Tela Cheia (Deitar Celular)"}
                aria-label="Tela Cheia"
              >
                {isFullScreen ? (
                  <Minimize2 className="h-5 w-5 text-white" />
                ) : (
                  <Maximize2 className="h-5 w-5 text-white" />
                )}
              </button>
            )}

            {/* Custom Overlay Controls (Visible on Hover - Volume) */}
            {isPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4 z-20 pointer-events-none">
                
                {/* Bottom control row */}
                <div className="space-y-3.5 pointer-events-auto">
                  
                  {/* Sub-controls line */}
                  <div className="flex items-center justify-between gap-4">
                    
                    {/* Left Side: Volume and Mute Tracker */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5 group/vol">
                        <button onClick={handleMuteToggle} className="text-white hover:text-indigo-400 transition-colors cursor-pointer">
                          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Right Side: Fullscreen Icon */}
                    <div className="flex items-center gap-3 pr-10">
                      <button onClick={toggleFullScreen} className="text-white hover:text-indigo-400 transition-colors cursor-pointer">
                        {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </button>
                    </div>

                  </div>

                </div>

              </div>
            )}

          </div>

          {/* SMART CTA INTELIGENTE (Animate on activation) */}
          <AnimatePresence>
            {showCta && (
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                className="bg-white border border-[#E2D3FE] rounded-[24px] p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md relative overflow-hidden"
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-emerald-700 text-xs font-bold uppercase tracking-wider">
                      {settings.offerTitle || 'Oferta Especial Disponível'}
                    </span>
                    <span className="text-zinc-900 font-semibold text-sm">
                      {settings.ctaText || 'Garanta sua vaga com 60% de desconto agora!'}
                    </span>
                  </div>
                </div>

                <motion.button
                  onClick={handleCtaClick}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 bg-[#7E2EFF] hover:bg-[#6419DB] text-white font-semibold text-sm rounded-2xl transition-all shadow-md w-full md:w-auto text-center font-sans cursor-pointer shrink-0"
                >
                  {settings.offerBtnText || 'Quero Aproveitar a Oferta'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

        </section>

        {/* RIGHT COLUMN: CHAT PANEL (33% on PC, 100% on Mobile) - WIDENED */}
        <aside className="lg:col-span-1 h-[500px] sm:h-[600px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-6 px-4 sm:px-0">
          <Chat 
            currentTime={currentTime}
            syncComments={syncComments}
            user={user}
            materials={materials}
            showCta={showCta}
            settings={settings}
          />
        </aside>

      </main>

      {/* Footer copyright with security checkmarks matching the design */}
      <footer className="w-full border-t border-[#ECE4FB] bg-[#F7F3FF] py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-[10px] sm:text-xs font-bold tracking-wider text-zinc-500 font-sans uppercase">
          
          {/* Left side: Navigation / Exit */}
          <div className="flex items-center gap-4">
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Sair da sala"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da Sala</span>
            </button>
          </div>

          {/* Right side: Security Badges matching screenshot */}
          <div className="flex items-center gap-4 sm:gap-6 text-[#706680]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
              <span>SITE SEGURO</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-4.5 w-4.5 text-emerald-500" />
              <span>PRIVACIDADE PROTEGIDA</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
