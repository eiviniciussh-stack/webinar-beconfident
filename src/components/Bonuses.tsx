import React from 'react';
import { Gift, Zap, ShieldCheck } from 'lucide-react';
import { Bonus } from '../types';

interface BonusesProps {
  items: Bonus[];
  primaryColor?: string;
}

export default function Bonuses({ items, primaryColor = '#8134FE' }: BonusesProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="w-full bg-[#1E1533] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-xl mt-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-zinc-800 rounded-lg text-amber-400">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-white">Bônus Exclusivos Inclusos</h3>
          <p className="text-xs text-zinc-400">Garantidos apenas para quem se inscrever nesta turma especial.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((bonus, i) => (
          <div
            key={bonus.id}
            className="group relative flex flex-col justify-between bg-zinc-950/60 rounded-xl overflow-hidden border border-zinc-800/60 hover:border-zinc-700/60 transition-all duration-300 shadow-lg"
          >
            <div>
              {/* Premium Image Header */}
              <div className="relative h-44 bg-zinc-900 overflow-hidden">
                {bonus.imageUrl ? (
                  <img
                    src={bonus.imageUrl}
                    alt={bonus.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-950">
                    <Gift className="h-10 w-10 text-zinc-700" />
                  </div>
                )}
                {/* Badge Number */}
                <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-md border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300">
                  BÔNUS 0{i + 1}
                </span>

                {/* Value tag */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 backdrop-blur-md rounded-md border border-emerald-500/20 text-[10px] font-mono font-bold text-emerald-400">
                  <Zap className="h-3 w-3" />
                  VALOR: {bonus.value || 'R$ 497'}
                </div>
              </div>

              {/* Text content */}
              <div className="p-5">
                <h4 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
                  {bonus.title}
                </h4>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed font-sans">
                  {bonus.description}
                </p>
              </div>
            </div>

            {/* Bottom confirmation tag */}
            <div className="px-5 pb-5 pt-2 border-t border-zinc-900 flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              100% LIBERADO NA COMPRA
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
