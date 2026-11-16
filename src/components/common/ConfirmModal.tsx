import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow-lg flex flex-col gap-4">
        <div className="flex items-center gap-2.5 text-[#a92f2e] dark:text-[#cf4a48]">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h3 className="font-heading text-base font-bold text-[#1d1c11] dark:text-[#f6f1de]">
            {title}
          </h3>
        </div>

        <p className="font-sans text-xs sm:text-sm text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          {message}
        </p>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm btn-retro-active cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="flex-1 h-11 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow btn-retro-active cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
