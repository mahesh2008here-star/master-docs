import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Search, User } from 'lucide-react';
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
    <header className="fixed top-0 left-0 right-0 z-40 pt-safe bg-[#fff9e7]/95 dark:bg-[#181711]/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 shadow-xs">
      <div className="h-16 px-3 sm:px-4 flex items-center justify-between gap-2 max-w-2xl mx-auto">
        {/* Left Section: Back button & Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isSubPage && onBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              aria-label="Navigate back"
              className="w-9 h-9 rounded-xl bg-[#f9f4e1] dark:bg-[#2b2921] flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          )}

          {/* Docs Badge */}
          <div className="h-8 px-2 rounded-lg bg-[#f3eedc] dark:bg-[#333128] retro-border-sm border-[#171717] flex items-center justify-center gap-1.5 shrink-0 retro-shadow-sm">
            <BookOpen className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
            <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
              DOCS
            </span>
          </div>

          {/* App Title */}
          <div className="flex flex-col min-w-0">
            <span className="font-heading text-xs sm:text-sm font-bold uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de] truncate">
              MASTER DOCS
            </span>
            <span className="font-sans text-[10px] uppercase tracking-widest text-[#58413f] dark:text-[#c8bead] truncate">
              {subtitle || (activeTab === 'reader' ? 'Document View' : activeTab)}
            </span>
          </div>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTab !== 'search' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onOpenSearch}
              aria-label="Search documents"
              className="w-9 h-9 rounded-xl bg-[#f9f4e1] dark:bg-[#2b2921] flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onOpenSettings}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-xs cursor-pointer transition-colors shrink-0"
            title="Account & Settings"
          >
            <User className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
