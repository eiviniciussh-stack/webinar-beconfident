import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQItem } from '../types';

interface FAQProps {
  items: FAQItem[];
}

export default function FAQ({ items }: FAQProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="w-full bg-[#1E1533] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-xl mt-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-zinc-800 rounded-lg text-emerald-400">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-white">Dúvidas Frequentes (FAQ)</h3>
          <p className="text-xs text-zinc-400">Tudo o que você precisa saber sobre o treinamento, acesso e bônus.</p>
        </div>
      </div>

      <div className="divide-y divide-zinc-800/60">
        {items.map((item) => {
          const isOpen = openId === item.id;
          return (
            <div key={item.id} className="py-4 first:pt-0 last:pb-0">
              <button
                onClick={() => toggleItem(item.id)}
                className="w-full flex justify-between items-center text-left py-2 font-medium text-zinc-100 hover:text-white transition-colors focus:outline-none group cursor-pointer"
              >
                <span className="text-sm sm:text-base pr-4 font-sans">{item.question}</span>
                <span className="flex-shrink-0 p-1 rounded-md bg-zinc-950/80 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  <ChevronDown
                    className={`h-4 w-4 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <p className="pt-3 pb-2 text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
