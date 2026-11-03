import React from 'react';
import { motion } from 'motion/react';
import { Home, FolderOpen, Bookmark, Clock, Settings } from 'lucide-react';
import { NavigationTab } from '../../types/document';
import { AnimatedIcon } from '../common/AnimatedIcon';

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
      <div className="max-w-md mx-auto mb-2 pointer-events-auto rounded-full bg-white/90 dark:bg-[#212019]/90 backdrop-blur-xl border border-black/10 dark:border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.18)] px-2 py-1 transition-all">
        <div className="flex items-center justify-around h-14 relative">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

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
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                    className="absolute inset-0 rounded-full bg-[var(--primary-red)]/12 dark:bg-[var(--primary-red)]/25 retro-border-sm -z-10"
                  />
                )}

                <AnimatedIcon
                  icon={tab.icon}
                  className="w-5 h-5"
                  isActive={isActive}
                  animateOnHover
                />

                <motion.span
                  animate={{
                    scale: isActive ? 1.05 : 1,
                    fontWeight: isActive ? 700 : 500,
                  }}
                  transition={{ duration: 0.2 }}
                  className={`font-sans text-[10px] sm:text-[11px] leading-none mt-1 ${
                    isActive ? 'text-[var(--primary-red)]' : 'text-[#58413f] dark:text-[#c8bead]'
                  }`}
                >
                  {tab.label}
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
