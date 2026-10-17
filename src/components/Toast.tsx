import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, description?: string) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const success = useCallback((title: string, description?: string) => toast('success', title, description), [toast]);
  const error = useCallback((title: string, description?: string) => toast('error', title, description), [toast]);
  const info = useCallback((title: string, description?: string) => toast('info', title, description), [toast]);
  const warning = useCallback((title: string, description?: string) => toast('warning', title, description), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-md"
            >
              <div className="flex-shrink-0">
                {item.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                {item.type === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                {item.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
                {item.type === 'info' && <Info className="h-5 w-5 text-sky-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{item.title}</p>
                {item.description && (
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{item.description}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(item.id)}
                className="flex-shrink-0 rounded-md p-1 text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
