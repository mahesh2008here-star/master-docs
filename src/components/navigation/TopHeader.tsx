import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Search, User } from 'lucide-react';
import { NavigationTab } from '../../types/document';
import { AnimatedIcon } from '../common/AnimatedIcon';

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
  const isSubPage = activeTab === 'reader' || activeTab === 'search' || activeTab === 'support';

  const contextLabel =
    subtitle ||
    (activeTab === 'reader'
      ? 'Reader'
      : activeTab === 'vault'
      ? 'Secure Vault'
      : activeTab === 'support'
      ? 'Support'
      : activeTab === 'favourites'
      ? 'Saved'
      : activeTab === 'recent'
      ? 'Recent'
      : activeTab === 'settings'
      ? 'Settings'
      : activeTab === 'search'
      ? 'Search'
      : 'Library');

  return (
    <header className="sticky top-0 left-0 right-0 z-40 w-full pt-safe bg-[#fff9e7]/95 dark:bg-[#1d1c11]/95 backdrop-blur-md border-b-2 border-[#171717] dark:border-[#38352b]">
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-2 max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {isSubPage && onBack ? (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onBack}
              aria-label="Navigate back"
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#212019] flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer shrink-0"
            >
              <AnimatedIcon icon={ArrowLeft} className="w-4 h-4" />
            </motion.button>
          ) : (
            <div
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="w-9 h-9 rounded-xl retro-border-sm retro-shadow-sm flex items-center justify-center text-white shrink-0"
            >
              <AnimatedIcon icon={BookOpen} className="w-4 h-4 text-white" />
            </div>
          )}

          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-heading text-sm sm:text-base font-extrabold tracking-tight text-[#1d1c11] dark:text-[#f6f1de] whitespace-nowrap truncate">
              MASTER DOCS
            </span>
            <span className="font-sans text-[10px] font-semibold uppercase tracking-wider text-[#58413f] dark:text-[#c8bead] truncate">
              {contextLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab !== 'search' && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onOpenSearch}
              aria-label="Search documents"
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#212019] flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer"
            >
              <AnimatedIcon icon={Search} className="w-4 h-4" />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onOpenSettings}
            style={{ backgroundColor: 'var(--primary-red)' }}
            aria-label="Open Settings"
            className="w-10 h-10 rounded-xl retro-border-sm retro-shadow-sm flex items-center justify-center text-white cursor-pointer shrink-0"
            title="Settings & Support"
          >
            <AnimatedIcon icon={User} className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      </div>
    </header>
  );
};
