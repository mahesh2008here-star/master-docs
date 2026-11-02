import React from 'react';
import { motion } from 'motion/react';
import { Home, FolderOpen, Bookmark, Clock, Settings } from 'lucide-react';
import { NavigationTab } from '../../types/document';

interface LiquidGlassDockProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as NavigationTab, label: 'Home', icon: Home },
    { id: 'files' as NavigationTab, label: 'Files', icon: FolderOpen },
    { id: 'favourites' as NavigationTab, label: 'Saved', icon: Bookmark },
    { id: 'recent' as NavigationTab, label: 'Recent', icon: Clock },
    { id: 'settings' as NavigationTab, label: 'Settings', icon: Settings },
  ];

  if (activeTab === 'reader') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe px-3 sm:px-4 pointer-events-none">
      <div className="max-w-md mx-auto mb-2 pointer-events-auto rounded-full bg-white/90 dark:bg-[#212019]/90 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.15)] px-2 py-1 transition-all">
        <div className="flex items-center justify-around h-14 relative">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="relative flex flex-col items-center justify-center min-w-[48px] sm:min-w-[56px] h-12 rounded-full cursor-pointer z-10 transition-colors"
                style={{
                  color: isActive ? 'var(--primary-red)' : undefined,
                }}
              >
                {/* Active tab background glow pill */}
                {isActive && (
                  <motion.div
                    layoutId="dock-active-pill"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-[var(--primary-red)]/10 dark:bg-[var(--primary-red)]/20 -z-10"
                  />
                )}

                <motion.div
                  whileTap={{ scale: 0.85, rotate: -6 }}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className={`flex items-center justify-center ${
                    isActive ? 'text-[var(--primary-red)]' : 'text-[#58413f] dark:text-[#c8bead]'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </motion.div>

                <span
                  className={`font-sans text-[10px] sm:text-[11px] leading-none mt-1 ${
                    isActive ? 'font-bold text-[var(--primary-red)]' : 'text-[#58413f] dark:text-[#c8bead]'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
