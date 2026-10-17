import React, { useState, useEffect, useRef } from 'react';
import { Star, MessageSquareQuote, ChevronLeft, ChevronRight } from 'lucide-react';
import { Testimonial } from '../types';

interface TestimonialsProps {
  items: Testimonial[];
}

export default function Testimonials({ items }: TestimonialsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    resetTimeout();
    if (items && items.length > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length);
      }, 6000);
    }
    return () => {
      resetTimeout();
    };
  }, [currentIndex, items]);

  if (!items || items.length === 0) return null;

  const handlePrev = () => {
    resetTimeout();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    resetTimeout();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const currentItem = items[currentIndex];

  return (
    <div className="w-full bg-[#1E1533] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-xl mt-8">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-lg text-emerald-400">
            <MessageSquareQuote className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-white">Casos de Sucesso de Alunos</h3>
            <p className="text-xs text-zinc-400">Resultados reais de quem decidiu agir e aplicar o método passo a passo.</p>
          </div>
        </div>

        {/* Carousel controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            className="p-1.5 bg-zinc-950/80 hover:bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-850 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 bg-zinc-950/80 hover:bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-850 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Carousel Active Card */}
      <div className="relative min-h-[160px] flex flex-col justify-between bg-zinc-950/50 p-6 sm:p-8 rounded-xl border border-zinc-800/60 overflow-hidden">
        {/* Subtle decorative quote background */}
        <div className="absolute right-6 bottom-4 text-zinc-800/20 text-8xl font-serif pointer-events-none select-none font-bold">
          ”
        </div>

        <div className="relative z-10">
          {/* Star rating */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Star
                key={idx}
                className={`h-4.5 w-4.5 ${
                  idx < (currentItem.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-zinc-700'
                }`}
              />
            ))}
          </div>

          <p className="text-sm sm:text-base text-zinc-300 italic leading-relaxed font-sans mb-6">
            "{currentItem.text}"
          </p>
        </div>

        {/* Author info */}
        <div className="flex items-center gap-3 relative z-10 border-t border-zinc-900 pt-4">
          <img
            src={currentItem.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80"}
            alt={currentItem.name}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-zinc-700"
          />
          <div>
            <h4 className="text-sm font-semibold text-white">{currentItem.name}</h4>
            <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">Aluno Verificado</p>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="flex justify-center items-center gap-1.5 mt-5">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              resetTimeout();
              setCurrentIndex(idx);
            }}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              idx === currentIndex ? 'w-6 bg-emerald-500' : 'w-1.5 bg-zinc-800 hover:bg-zinc-600'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
