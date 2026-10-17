import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Clock, Paperclip, Smile, ShieldCheck, Lock, Gift, Timer, Users, Radio } from 'lucide-react';
import { SyncComment, User, UserQuestion, Material } from '../types';
import { useToast } from './Toast';

interface ChatProps {
  currentTime: number; // in seconds
  syncComments: SyncComment[];
  user: User;
  materials: Material[];
  showCta: boolean;
  settings: any;
}

export default function Chat({ currentTime, syncComments, user, materials, showCta, settings }: ChatProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'questions' | 'offer'>('chat');
  const [questionText, setQuestionText] = useState('');
  const [chatInputText, setChatInputText] = useState('');
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([]);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [localComments, setLocalComments] = useState<SyncComment[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  
  const toast = useToast();
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const [serverRealComments, setServerRealComments] = useState<SyncComment[]>([]);

  // Periodically fetch real comments from server so all users see live audience messages
  useEffect(() => {
    const fetchRealComments = async () => {
      try {
        const res = await fetch('/api/real-comments');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setServerRealComments(prev => {
              const map = new Map<string, SyncComment>();
              prev.forEach(c => map.set(c.id, c));
              data.forEach(c => map.set(c.id, c));
              return Array.from(map.values());
            });
          }
        }
      } catch (e) {}
    };

    fetchRealComments();
    const interval = setInterval(fetchRealComments, 1500);
    return () => clearInterval(interval);
  }, []);

  // Filter preset comments based on current video playhead
  const visiblePresetComments = syncComments.filter((c) => c.time <= currentTime);
  
  // Combine preset timed comments, local typed comments, and server real comments without duplicates
  const signatureSet = new Set<string>();
  const combinedMap = new Map<string, SyncComment>();

  // 1. Preset automated comments
  visiblePresetComments.forEach((c) => {
    combinedMap.set(c.id, c);
    signatureSet.add(`${c.name.trim().toLowerCase()}|${c.message.trim().toLowerCase()}`);
  });

  // 2. Real comments from live audience / admin
  serverRealComments.forEach((c) => {
    combinedMap.set(c.id, c);
    signatureSet.add(`${c.name.trim().toLowerCase()}|${c.message.trim().toLowerCase()}`);
  });

  // 3. Local optimistic comments (only added if not already covered by serverRealComments or preset)
  localComments.forEach((c) => {
    const sig = `${c.name.trim().toLowerCase()}|${c.message.trim().toLowerCase()}`;
    if (!signatureSet.has(sig) && !combinedMap.has(c.id)) {
      combinedMap.set(c.id, c);
      signatureSet.add(sig);
    }
  });

  const allVisibleComments = Array.from(combinedMap.values()).sort((a, b) => a.time - b.time);

  // Auto scroll chat to bottom when comments pop up (internal container only, never window)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [allVisibleComments.length, activeTab]);

  // Listen for offer activation to switch tab to offer
  useEffect(() => {
    if (showCta) {
      setActiveTab('offer');
      setTimeLeft(settings.offerDuration || 600);
    }
  }, [showCta, settings.offerDuration]);

  // Offer countdown timer running in background
  useEffect(() => {
    if (!showCta || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [showCta, timeLeft]);

  // Format countdown seconds to MM:SS
  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fetch real user questions
  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/questions');
      if (response.ok) {
        const data: UserQuestion[] = await response.json();
        // Filter questions submitted by this logged-in email or userId
        const userEmailClean = (user.email || '').trim().toLowerCase();
        const filtered = data.filter(q => (q.email || '').trim().toLowerCase() === userEmailClean || (user.id && q.userId === user.id));
        setUserQuestions(prev => {
          const map = new Map<string, UserQuestion>();
          prev.forEach(q => map.set(q.id, q));
          filtered.forEach(q => {
            const existing = map.get(q.id);
            if (existing) {
              map.set(q.id, { ...existing, ...q });
            } else {
              map.set(q.id, q);
            }
          });
          return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }
    } catch (err) {
      console.error("Error fetching user questions:", err);
    }
  };

  useEffect(() => {
    fetchQuestions();
    const interval = setInterval(fetchQuestions, 1500);
    return () => clearInterval(interval);
  }, [user.email, user.id]);

  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setIsSubmittingQuestion(true);
    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          email: user.email,
          question: questionText.trim(),
          userId: user.id
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao enviar pergunta');
      }

      toast.success('Pergunta Enviada!', 'Sua dúvida foi enviada aos administradores do webinar.');
      setQuestionText('');
      fetchQuestions();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar', 'Não foi possível cadastrar sua pergunta no servidor.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;

    const tempId = `user-${Date.now()}`;
    const newComment: SyncComment = {
      id: tempId,
      name: user.name,
      message: chatInputText.trim(),
      time: currentTime,
      photoUrl: ''
    };

    setLocalComments(prev => [...prev, newComment]);
    setChatInputText('');

    // Persist user comment on server so admin can see it
    try {
      const res = await fetch('/api/real-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          message: newComment.message,
          time: currentTime
        })
      });

      if (res.ok) {
        const savedComment: SyncComment = await res.json();
        setServerRealComments(prev => {
          if (prev.some(c => c.id === savedComment.id)) return prev;
          return [...prev, savedComment];
        });
        setLocalComments(prev => prev.filter(c => c.id !== tempId));
      }
    } catch (err) {
      console.error("Error saving real comment:", err);
    }
  };

  return (
    <div className="flex flex-col bg-[#F7F3FF] border border-zinc-200/80 rounded-2xl overflow-hidden shadow-md h-full">
      {/* Tab Selectors (Pills wrapper matching screenshot) */}
      <div className="p-1.5 bg-[#ECE4FB]/70 m-3 rounded-xl flex gap-1 border border-zinc-200/40">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center rounded-lg ${
            activeTab === 'chat'
              ? 'bg-white text-zinc-800 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Chat
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center rounded-lg ${
            activeTab === 'questions'
              ? 'bg-white text-zinc-800 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          }`}
        >
          Suporte
        </button>

        {showCta && (
          <button
            onClick={() => setActiveTab('offer')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer text-center rounded-lg flex items-center justify-center gap-1 bg-emerald-500/10 text-emerald-600 hover:text-emerald-700 ${
              activeTab === 'offer'
                ? '!bg-emerald-500 !text-white shadow-sm'
                : ''
            }`}
          >
            <Gift className="h-3.5 w-3.5" />
            Oferta
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar" ref={chatContainerRef}>
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2 min-h-full flex flex-col justify-between"
            >
              {allVisibleComments.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400">
                  <Clock className="h-6 w-6 text-zinc-300 animate-pulse mb-2" />
                  <p className="text-xs">Aguardando comentários...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {allVisibleComments.map((comment) => {
                    const isSpecial = comment.message.toLowerCase().includes('comprei') || comment.message.toLowerCase().includes('adquiri');
                    return (
                      <motion.div
                        key={comment.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm py-0.5 flex flex-wrap items-baseline font-sans leading-relaxed text-left"
                      >
                        <span className="font-bold text-zinc-400 mr-2 shrink-0 select-none">
                          {comment.name}
                        </span>
                        <span className={`text-[#20044E] break-words [word-break:normal] ${
                          isSpecial 
                            ? 'font-semibold italic text-indigo-600 bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100/40' 
                            : ''
                        }`}>
                          {comment.message}
                        </span>
                      </motion.div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'questions' && (
            <motion.div
              key="questions-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 flex flex-col justify-between h-full"
            >
              <div className="flex-1 overflow-y-auto space-y-3">
                <div className="border border-indigo-100 bg-indigo-50/40 p-3 rounded-lg text-xs text-indigo-700 leading-relaxed font-sans">
                  Envie sua dúvida no formulário abaixo! Ela será respondida de forma personalizada pela nossa equipe de suporte.
                </div>

                {userQuestions.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 text-xs">
                    Nenhuma dúvida enviada ainda.
                  </div>
                ) : (
                  userQuestions.map((q) => (
                    <div key={q.id} className="p-3 bg-white border border-zinc-200/60 rounded-xl space-y-2 shadow-sm text-left">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
                        <span className="text-zinc-400">{new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={`px-2 py-0.5 rounded-full font-sans font-bold uppercase tracking-wider text-[9px] ${
                          q.answered ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                          {q.answered ? 'Respondida' : 'Enviada'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-800 font-sans">{q.question}</p>

                      {q.answered && q.answer && (
                        <div className="mt-2 p-2.5 bg-zinc-50 rounded-lg border-l-2 border-indigo-500 text-[11px] text-zinc-600 space-y-1 font-sans">
                          <p className="font-semibold text-zinc-800">Suporte respondeu:</p>
                          <p>{q.answer}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'offer' && showCta && (
            <motion.div
              key="offer-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5 flex flex-col justify-center items-center py-6 text-center font-sans h-full"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 text-emerald-500 animate-pulse">
                <Gift className="h-8 w-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-zinc-900 uppercase tracking-tight">
                  {settings.tabOfferTitle || 'Oportunidade Exclusiva'}
                </h3>
                <p className="text-xs text-zinc-500">
                  {settings.tabOfferSubtitle || 'Esta oferta expira em breve. Garanta sua vaga com desconto!'}
                </p>
              </div>

              {/* Countdown box */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-6 py-3.5 flex flex-col items-center justify-center shadow-lg w-full max-w-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-1">Tempo Restante</span>
                <div className="flex items-center gap-2 text-2xl font-mono font-black text-emerald-400">
                  <Timer className="h-5 w-5 text-emerald-500 animate-pulse" />
                  <span>{formatCountdown(timeLeft)}</span>
                </div>
              </div>

              {/* CTA Info card */}
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-xs text-emerald-800 leading-relaxed w-full max-w-xs font-semibold text-left whitespace-pre-line space-y-1">
                {settings.tabOfferDescription ? (
                  settings.tabOfferDescription
                ) : (
                  <>
                    <p className="font-bold text-sm text-emerald-950">✓ Bônus Exclusivos Inclusos</p>
                    <p>✓ Acesso imediato à área de membros</p>
                    <p>✓ Suporte VIP & Certificação Completa</p>
                  </>
                )}
              </div>

              {/* Action button */}
              <motion.button
                onClick={() => {
                  fetch('/api/cta/click', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user?.id, email: user?.email })
                  }).catch(err => console.error(err));
                  window.open(settings.ctaLink || 'https://pay.hotmart.com', '_blank', 'noopener,noreferrer');
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full max-w-xs py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer font-sans"
              >
                {settings.offerBtnText || settings.ctaText || 'QUERO APROVEITAR A OFERTA'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message Input container at bottom */}
      {activeTab !== 'offer' && (
        <div className="border-t border-zinc-200/60 bg-white p-3">
          {activeTab === 'chat' ? (
            <form onSubmit={handleSendChatMessage} className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                placeholder="Digite algo..."
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-zinc-800 placeholder-zinc-400 py-1"
              />
              <div className="flex items-center gap-2.5 text-zinc-400">
                <Paperclip className="h-4.5 w-4.5 hover:text-zinc-600 cursor-pointer transition-colors" />
                <Smile className="h-4.5 w-4.5 hover:text-zinc-600 cursor-pointer transition-colors" />
                <button 
                  type="submit" 
                  disabled={!chatInputText.trim()}
                  className="p-1 hover:text-indigo-600 text-zinc-400 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendQuestion} className="flex items-center justify-between gap-2">
              <input
                type="text"
                required
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Sua dúvida para o suporte..."
                disabled={isSubmittingQuestion}
                className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-zinc-800 placeholder-zinc-400 py-1"
              />
              <div className="flex items-center gap-2 text-zinc-400">
                <button 
                  type="submit" 
                  disabled={isSubmittingQuestion || !questionText.trim()}
                  className="p-1 hover:text-indigo-600 text-zinc-400 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Send className="h-4.5 w-4.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
