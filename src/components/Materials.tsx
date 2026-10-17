import React from 'react';
import { FileText, Table, CheckSquare, ExternalLink, Download } from 'lucide-react';
import { Material } from '../types';

interface MaterialsProps {
  items: Material[];
}

export default function Materials({ items }: MaterialsProps) {
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText className="h-5 w-5 text-red-400" />;
      case 'Planilha':
        return <Table className="h-5 w-5 text-emerald-400" />;
      case 'Checklist':
        return <CheckSquare className="h-5 w-5 text-amber-400" />;
      default:
        return <ExternalLink className="h-5 w-5 text-sky-400" />;
    }
  };

  const handleDownload = (item: Material) => {
    // We can simulate download/opening link
    if (item.url && item.url !== '#') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      // Create mockup action
      alert(`Simulação: Baixando arquivo "${item.title}"`);
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-950/40 rounded-xl border border-zinc-800/40">
        <FileText className="h-8 w-8 text-zinc-600 mb-2" />
        <p className="text-sm text-zinc-400">Nenhum material disponível neste webinar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="group flex items-start gap-3.5 p-4 bg-zinc-950/50 hover:bg-zinc-950 border border-zinc-800/60 rounded-xl transition-all duration-300"
        >
          <div className="p-2.5 bg-zinc-900 rounded-lg flex-shrink-0">
            {getIcon(item.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors truncate">
                {item.title}
              </h4>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800/80">
                {item.type}
              </span>
            </div>
            {item.description && (
              <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            )}
            
            <button
              onClick={() => handleDownload(item)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-sans font-medium"
            >
              <Download className="h-3.5 w-3.5" />
              {item.type === 'Link' ? 'Acessar Link' : 'Baixar Material'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
