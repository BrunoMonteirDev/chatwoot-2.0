import React, { useEffect } from 'react';
import { CheckCircle2, Info, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type?: 'success' | 'info' | 'error';
  title: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  isDarkMode?: boolean;
}

export const ToastContainer: React.FC<ToastProps> = ({
  toasts,
  onDismiss,
  isDarkMode = true,
}) => {
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      onDismiss(toasts[0].id);
    }, 3000);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[10000] flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-5 fade-in ${
            isDarkMode
              ? 'bg-[#182229]/95 border-[#2a3942] text-[#e9edef]'
              : 'bg-white/95 border-gray-200 text-[#111b21]'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : toast.type === 'info' ? (
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-[#00a884] shrink-0" />
          )}
          <span className="text-xs font-medium truncate">{toast.title}</span>
        </div>
      ))}
    </div>
  );
};
