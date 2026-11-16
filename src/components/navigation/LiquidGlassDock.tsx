import React from 'react';
import { motion } from 'motion/react';
import { Home, ShieldCheck, Bookmark, Clock, Settings } from 'lucide-react';
import { NavigationTab } from '../../types/document';
import { AnimatedIcon } from '../common/AnimatedIcon';

interface LiquidGlassDockProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
}

export const LiquidGlassDock: React.FC<LiquidGlassDockProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'home' as NavigationTab, label: 'Home', icon: Home },
    { id: 'vault' as NavigationTab, label: 'Vault', icon: ShieldCheck },
    { id: 'favourites' as NavigationTab, label: 'Saved', icon: Bookmark },
    { id: 'recent' as NavigationTab, label: 'Recent', icon: Clock },
    { id: 'settings' as NavigationTab, label: 'Settings', icon: Settings },
  ];

  if (activeTab === 'reader') {
    return null;
  }

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe px-3 pointer-events-none"
    >
      <div className="max-w-md mx-auto mb-1.5 pointer-events-auto rounded-full bg-[#f3eedc]/92 dark:bg-[#2b2921]/92 backdrop-blur-xl retro-border retro-shadow-lg px-2 py-1.5">
        <div className="grid grid-cols-5 items-center h-13 relative gap-1">
          {tabs.map((tab) => {
            const isActive =
              activeTab === tab.id || (tab.id === 'settings' && activeTab === 'support');

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className="relative flex flex-col items-center justify-center h-12 rounded-full cursor-pointer z-10 transition-colors px-1"
                style={{
                  color: isActive ? '#ffffff' : undefined,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="dock-active-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 32 }}
                    style={{ backgroundColor: 'var(--primary-red)' }}
                    className="absolute inset-0 rounded-full retro-border-sm retro-shadow-sm -z-10"
                  />
                )}

                <AnimatedIcon
                  icon={tab.icon}
                  className={`w-[18px] h-[18px] ${
                    isActive ? 'text-white' : 'text-[#1d1c11] dark:text-[#f6f1de]'
                  }`}
                  isActive={isActive}
                  animateOnHover
                />

                <span
                  className={`font-heading text-[10px] leading-none mt-1 whitespace-nowrap ${
                    isActive
                      ? 'font-bold text-white'
                      : 'font-semibold text-[#58413f] dark:text-[#c8bead]'
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
