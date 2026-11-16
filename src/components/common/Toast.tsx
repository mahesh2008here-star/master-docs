import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto pointer-events-auto"
        >
          <div className="px-4 py-2.5 rounded-2xl bg-[#1d1c11] dark:bg-[#f6f1de] text-[#fff9e7] dark:text-[#1d1c11] retro-border retro-shadow flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#4ade80] dark:text-[#16a34a] shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[#f87171] dark:text-[#dc2626] shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-[#60a5fa] dark:text-[#2563eb] shrink-0" />
              )}
              <span className="font-sans text-xs font-medium truncate">
                {toast.message}
              </span>
            </div>
            <button
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-80 hover:opacity-100 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
