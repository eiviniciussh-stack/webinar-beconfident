import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useToast } from './Toast';
import { ShieldCheck, Lock, ChevronDown } from 'lucide-react';
import { User, Settings } from '../types';
import BrandHeader from './BrandHeader';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
  onAdminClick: () => void;
  settings: Settings;
}

export default function LoginScreen({ onLoginSuccess, onAdminClick, settings }: LoginScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); // Stores the WhatsApp number
  const [revenue, setRevenue] = useState('');
  const [saveData, setSaveData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const savedName = localStorage.getItem('webinar_user_name');
    const savedEmail = localStorage.getItem('webinar_user_email');
    if (savedName && savedEmail) {
      setName(savedName);
      setEmail(savedEmail);
      setSaveData(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail) {
      toast.error('Preencha os campos!', 'Nome e WhatsApp são necessários para acessar.');
      return;
    }

    setIsLoading(true);

    const userObj: User = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: cleanName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
      role: 'user'
    };

    // Save locally immediately
    localStorage.setItem('webinar_user_name', cleanName);
    localStorage.setItem('webinar_user_email', cleanEmail);

    // Lead webhook is fired by the server (/api/users/login) using the URL set in the admin panel.

    // Register on server in parallel
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, email: cleanEmail, faturamento: revenue }),
        signal: controller.signal
      })
        .then(res => res.ok ? res.json() : null)
        .then(serverUser => {
          clearTimeout(timeoutId);
          if (serverUser) {
            onLoginSuccess(serverUser);
          }
        })
        .catch(() => clearTimeout(timeoutId));
    } catch (e) {}

    // Immediate fast entry to webinar room
    toast.success(`Bem-vindo, ${cleanName}!`, 'Acesso liberado. Entrando na transmissão...');
    setTimeout(() => {
      onLoginSuccess(userObj);
      setIsLoading(false);
    }, 250);
  };

  const highlight = settings.highlightText || '';
  const title = settings.title || 'Aula ao vivo BeConfident';
  const renderTitle = () => {
    if (highlight && title.includes(highlight)) {
      const [before, ...rest] = title.split(highlight);
      return (<>{before}<span className="text-[#8134FE]">{highlight}</span>{rest.join(highlight)}</>);
    }
    return title;
  };

  const inputCls = "w-full px-4 py-3.5 bg-[#F7F3FF] border border-[#E6E0F0] focus:border-[#8134FE] focus:ring-4 focus:ring-[#8134FE]/10 rounded-2xl text-sm text-[#20044E] placeholder-[#8A8199] focus:outline-none transition-all font-sans";

  return (
    <div className="relative min-h-screen w-full flex flex-col font-sans overflow-x-hidden bg-[#F2EBFF]">
      {/* Soft brand glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[#D0BAFD]/50 blur-3xl" />
        <div className="absolute bottom-[-200px] right-[-120px] w-[500px] h-[500px] rounded-full bg-[#E9E2FF] blur-3xl" />
      </div>

      <div className="relative">
        <BrandHeader label={settings.logoText} />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-4 py-8 sm:py-12 my-auto flex flex-col items-center text-center space-y-6 sm:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#20044E] text-xs sm:text-sm font-semibold shadow-[0_4px_20px_-6px_rgba(45,20,97,0.22)]"
        >
          <span className="w-2 h-2 rounded-full bg-[#8134FE] animate-pulse" />
          {settings.badgeText || 'Aula online e gratuita'}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="space-y-3 sm:space-y-4 max-w-2xl mx-auto px-1"
        >
          <h1 className="text-[28px] sm:text-4xl lg:text-5xl font-semibold text-[#20044E] leading-[1.15] tracking-tight">
            {renderTitle()}
          </h1>
          <p className="text-[#706680] text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
            {settings.description}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md bg-white shadow-[0_24px_60px_-20px_rgba(45,20,97,0.35)] rounded-[28px] p-6 sm:p-8 text-left space-y-5"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-[#20044E] text-center tracking-tight">
            Garanta sua vaga gratuitamente
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className={inputCls} />
            <input type="tel" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="WhatsApp" className={inputCls} />

            <div className="relative group">
              <select
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className={`${inputCls} cursor-pointer appearance-none pr-10 ${revenue ? 'font-medium' : '!text-[#8A8199]'}`}
              >
                <option value="" disabled>Qual é faturamento mensal?</option>
                <option value="Até R$ 50 mil">Até R$ 50 mil</option>
                <option value="De R$ 50 mil a R$ 200 mil">De R$ 50 mil a R$ 200 mil</option>
                <option value="De R$ 200 mil a R$ 500 mil">De R$ 200 mil a R$ 500 mil</option>
                <option value="Acima de R$ 500 mil">Acima de R$ 500 mil</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8134FE] pointer-events-none" />
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 bg-[#7E2EFF] hover:bg-[#6419DB] text-white font-semibold text-base rounded-2xl transition-all cursor-pointer shadow-[0_12px_30px_-10px_rgba(126,46,255,0.7)] flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Acessando transmissão...
                </>
              ) : (
                'Acessar transmissão'
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>

      <footer className="relative z-10 w-full max-w-4xl mx-auto py-6 px-4 text-center mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-[#706680] text-[11px] sm:text-xs font-semibold tracking-wider uppercase">
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#8134FE]" /><span>Site seguro</span></div>
          <div className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-[#8134FE]" /><span>Privacidade protegida</span></div>
        </div>
      </footer>
    </div>
  );
}
