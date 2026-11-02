import React from 'react';
import { motion } from 'motion/react';
import { NavigationTab } from '../../types/document';

interface LiquidGlassDockProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { id: NavigationTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'cottage' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'favourites', label: 'Saved', icon: 'bookmark_heart' },
    { id: 'recent', label: 'Recent', icon: 'history_toggle_off' },
    { id: 'settings', label: 'Settings', icon: 'tune' },
  ];

  if (activeTab === 'reader') {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe px-4 pointer-events-none">
      <div className="max-w-md mx-auto mb-2 pointer-events-auto rounded-full bg-white/80 dark:bg-[#212019]/85 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.15)] px-2 py-1 transition-all">
        <div className="flex items-center justify-around h-14 relative">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="relative flex flex-col items-center justify-center min-w-[52px] h-12 rounded-full cursor-pointer z-10 transition-colors"
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

                <motion.span
                  whileTap={{ scale: 0.8, rotate: -8 }}
                  animate={{ scale: isActive ? 1.12 : 1 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className={`material-symbols-outlined text-[22px] ${
                    isActive ? '' : 'text-[#58413f] dark:text-[#c8bead] hover:text-[#1d1c11]'
                  }`}
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </motion.span>

                <span
                  className={`font-sans text-[11px] leading-none mt-1 ${
                    isActive ? 'font-bold' : 'text-[#58413f] dark:text-[#c8bead]'
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
