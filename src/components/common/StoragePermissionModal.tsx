import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HardDrive, ShieldCheck, FolderSearch, ArrowRight } from 'lucide-react';
import { isNativeAndroid } from '../../services/nativeStorageService';

interface StoragePermissionModalProps {
  isOpen: boolean;
  isBusy?: boolean;
  onGrantAccess: () => void;
  onSkip: () => void;
}

export const StoragePermissionModal: React.FC<StoragePermissionModalProps> = ({
  isOpen,
  isBusy = false,
  onGrantAccess,
  onSkip,
}) => {
  const nativeAndroid = isNativeAndroid();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow-lg flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: 'var(--primary-red)' }}
                className="w-12 h-12 rounded-2xl retro-border-sm retro-shadow-sm flex items-center justify-center text-white shrink-0"
              >
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de] mb-1">
                  FIRST-TIME SETUP
                </span>
                <h2 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] leading-tight">
                  Allow All Files Access
                </h2>
              </div>
            </div>

            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] leading-relaxed">
              {nativeAndroid
                ? 'Grant "Manage All Files" permission so MASTER DOCS can automatically scan your device storage and show all your PDFs, Word docs, spreadsheets, slides, and notes right on the Home screen.'
                : 'Enable local storage access to scan or select documents from your device and organize every PDF, Word, Excel, PowerPoint, and text file right on your Home screen.'}
            </p>

            <div className="p-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-sans text-[#1d1c11] dark:text-[#f6f1de]">
                <FolderSearch className="w-4 h-4 text-[#249B65] shrink-0" />
                <span>Auto-detects PDF, DOCX, XLSX, PPTX, CSV & Text</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-sans text-[#1d1c11] dark:text-[#f6f1de]">
                <ShieldCheck className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
                <span>100% offline — files never leave your device</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={isBusy}
                onClick={onGrantAccess}
                style={{ backgroundColor: 'var(--primary-red)' }}
                className="w-full min-h-[46px] px-4 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isBusy ? 'Opening Storage...' : 'Allow Manage All Files'}</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </motion.button>

              <button
                type="button"
                disabled={isBusy}
                onClick={onSkip}
                className="w-full min-h-[42px] px-4 rounded-xl bg-white dark:bg-[#212019] text-[#58413f] dark:text-[#c8bead] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm cursor-pointer"
              >
                Not Now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
