import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LogOut, ShieldCheck, Headphones, X } from 'lucide-react';

/** BeConfident logo mark (white smile on purple rounded square). */
export function BeConfidentMark({ size = 48 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center bg-[#7E2EFF] shadow-[0_8px_24px_-8px_rgba(126,46,255,0.6)]"
      style={{ width: size, height: size, borderRadius: size / 3 }}
    >
      <svg viewBox="0 0 21.666 18.124" width={size * 0.46} height={size * 0.4} fill="#fff" aria-hidden="true">
        <path d="M10.828 15.23C8.011 15.24 5.3 14.151 3.273 12.194 1.215 10.23.035 7.519.001 4.674-.019 3.328.22 1.991.706.736.93.146 1.599-.15 2.192.076c.597.222.893.882.668 1.467-.381.99-.568 2.043-.552 3.104.026 2.241.955 4.377 2.577 5.924 1.63 1.57 3.784 2.412 6.06 2.39 4.7-.062 8.475-3.889 8.417-8.531-.011-.985-.198-1.959-.552-2.878-.108-.283-.098-.598.028-.873.126-.276.357-.49.641-.594.593-.226 1.257.069 1.486.66.448 1.166.686 2.399.7 3.658.042 2.844-1.065 5.586-3.07 7.604-2.01 2.045-4.75 3.208-7.618 3.233h-.149Z" />
        <path d="M15.109 6.278c-.638 0-1.154-.51-1.154-1.14V2.815c0-.63.516-1.14 1.154-1.14.637 0 1.154.51 1.154 1.14v2.323c0 .63-.517 1.14-1.154 1.14Zm-8.182 0c-.638 0-1.154-.51-1.154-1.14V2.815c0-.63.516-1.14 1.153-1.14.638 0 1.154.51 1.154 1.14v2.323c0 .63-.516 1.14-1.154 1.14ZM3.845 18.124c1.018 0 1.844-.808 1.844-1.805 0-.996-.826-1.804-1.844-1.804C2.826 14.515 2 15.323 2 16.319c0 .997.826 1.805 1.845 1.805ZM11.019 7.448c-.638 0-1.154-.51-1.154-1.14V1.639c0-.63.516-1.139 1.154-1.139.637 0 1.154.51 1.154 1.14v4.673c0 .63-.517 1.14-1.154 1.14Z" />
      </svg>
    </span>
  );
}

export interface BrandMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}

interface BrandHeaderProps {
  /** Small text shown next to the logo (e.g. event name). */
  label?: string;
  /** Extra element shown before the Menu button (e.g. live badge). */
  right?: React.ReactNode;
  items?: BrandMenuItem[];
  userName?: string;
}

/**
 * Header inspired by beconfident.app: purple logo tile on the left,
 * white "Menu" pill on the right that opens a floating card.
 */
export default function BrandHeader({ label, right, items = [], userName }: BrandHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <header className="relative z-40 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BeConfidentMark size={48} />
          <div className="hidden sm:flex flex-col leading-tight min-w-0">
            <span className="text-[15px] font-bold text-[#20044E] tracking-tight">BeConfident</span>
            {label && <span className="text-xs text-[#706680] truncate max-w-[320px]">{label}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2" ref={ref}>
          {right}
          {items.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex items-center gap-2.5 bg-white rounded-2xl pl-2 pr-4 py-2 shadow-[0_4px_20px_-6px_rgba(45,20,97,0.22)] hover:shadow-[0_6px_24px_-6px_rgba(45,20,97,0.35)] transition-shadow cursor-pointer"
              >
                <span className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#AE88FB] via-[#8134FE] to-[#20044E] flex items-center justify-center">
                  {open ? <X className="h-4 w-4 text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-white/90 translate-x-1 -translate-y-1" />}
                </span>
                <span className="text-sm font-medium text-[#20044E]">Menu</span>
              </button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl p-2 shadow-[0_20px_50px_-12px_rgba(45,20,97,0.35)] border border-[#ECE4FB]"
                  >
                    {userName && (
                      <div className="px-3 py-2.5 mb-1 border-b border-[#F2EBFF]">
                        <p className="text-[11px] uppercase tracking-wider text-[#8A8199] font-semibold">Conectado como</p>
                        <p className="text-sm font-semibold text-[#20044E] truncate">{userName}</p>
                      </div>
                    )}
                    {items.map((it) => (
                      <button
                        key={it.label}
                        onClick={() => {
                          setOpen(false);
                          it.onClick();
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors cursor-pointer ${
                          it.danger ? 'text-red-600 hover:bg-red-50' : 'text-[#20044E] hover:bg-[#F2EBFF]'
                        }`}
                      >
                        {it.icon}
                        {it.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export const menuIcons = {
  logout: <LogOut className="h-4 w-4" />,
  secure: <ShieldCheck className="h-4 w-4" />,
  support: <Headphones className="h-4 w-4" />,
};
