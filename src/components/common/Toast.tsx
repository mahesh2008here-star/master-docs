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
          className="fixed top-18 left-4 right-4 z-50 max-w-md mx-auto pointer-events-auto"
        >
          <div className="px-3.5 py-2.5 rounded-xl bg-[#f9f4e1] dark:bg-[#2b2921] retro-border retro-shadow flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-[#249B65] shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-[#3478D4] shrink-0" />
              )}
              <span className="font-sans text-xs font-medium text-[#1d1c11] dark:text-[#f6f1de] truncate">
                {toast.message}
              </span>
            </div>
            <button
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="text-[#58413f] dark:text-[#c8bead] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
