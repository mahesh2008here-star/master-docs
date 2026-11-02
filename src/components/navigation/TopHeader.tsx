import React from 'react';
import { motion } from 'motion/react';
import { NavigationTab } from '../../types/document';

interface TopHeaderProps {
  activeTab: NavigationTab;
  subtitle?: string;
  onOpenSearch: () => void;
  onBack?: () => void;
  onOpenSettings?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  subtitle,
  onOpenSearch,
  onBack,
  onOpenSettings,
}) => {
  const isSubPage = activeTab === 'reader' || activeTab === 'search';

  return (
    <header className="fixed top-0 left-0 right-0 z-40 pt-safe bg-[#fff9e7]/90 dark:bg-[#181711]/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 shadow-xs">
      <div className="h-16 px-4 flex items-center justify-between gap-2 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 min-w-0">
          {isSubPage && onBack ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              aria-label="Navigate back"
              className="w-10 h-10 rounded-lg bg-[#f9f4e1] dark:bg-[#2b2921] flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </motion.button>
          ) : null}

          <div className="h-8 px-2 rounded-lg bg-[#f3eedc] dark:bg-[#333128] retro-border-sm border-[#171717] flex items-center justify-center gap-1 shrink-0 retro-shadow-sm">
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ color: 'var(--primary-red)' }}
            >
              menu_book
            </span>
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
              DOCS
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <span className="font-heading text-sm uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de] truncate">
              MASTER DOCS
            </span>
            <span className="font-sans text-[11px] uppercase tracking-widest text-[#58413f] dark:text-[#c8bead] truncate">
              {subtitle || (activeTab === 'reader' ? 'Document View' : activeTab)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab !== 'search' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onOpenSearch}
              aria-label="Search documents"
              className="w-10 h-10 rounded-lg bg-[#f9f4e1] dark:bg-[#2b2921] flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onOpenSettings}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xs cursor-pointer transition-colors"
            title="Account & Settings"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
};
