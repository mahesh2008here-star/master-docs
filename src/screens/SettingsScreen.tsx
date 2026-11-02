import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { AppSettings } from '../types/document';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClearCache: () => void;
  onClearHistory: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onClearCache,
  onClearHistory,
  onExportBackup,
  onImportBackup,
}) => {
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const activeColor = settings.customAccentColor || settings.accentColor || '#a92f2e';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-5 pb-28"
    >
      {/* Header Badge */}
      <div className="flex items-center justify-between px-1">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          APPLICATION SETTINGS
        </span>
        <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">v1.0.0 Stable</span>
      </div>

      {/* 1. APPEARANCE & MATERIAL COLOR SECTION */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: 'var(--primary-red)' }}
          >
            palette
          </span>
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
            Appearance & Themes
          </h3>
        </div>

        {/* Theme mode toggle */}
        <div className="flex flex-col gap-2">
          <label className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">
            Interface Theme
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Light', icon: 'light_mode' },
              { id: 'dark', label: 'Dark Ink', icon: 'dark_mode' },
              { id: 'system', label: 'System', icon: 'settings_night_sight' },
            ].map((t) => {
              const isActive = settings.themeMode === t.id;
              return (
                <motion.button
                  key={t.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onUpdateSettings({ themeMode: t.id as any })}
                  style={{
                    backgroundColor: isActive ? 'var(--primary-red)' : undefined,
                  }}
                  className={`h-11 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm cursor-pointer flex items-center justify-center gap-1.5 transition-colors ${
                    isActive
                      ? 'text-white retro-shadow-sm'
                      : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                  <span>{t.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* CUSTOM MATERIAL ACCENT COLOR SECTION - FIXED NO GLITCH */}
        <div className="flex flex-col gap-3 pt-3 border-t border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <label className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">
              Material Accent Color
            </label>
            <span className="font-mono text-xs font-bold text-[#58413f] dark:text-[#c8bead] uppercase">
              {activeColor}
            </span>
          </div>

          {/* Swatches List */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0">
            {[
              { label: 'Terracotta', hex: '#a92f2e' },
              { label: 'Cobalt', hex: '#3478d4' },
              { label: 'Emerald', hex: '#249b65' },
              { label: 'Amber', hex: '#d88b32' },
              { label: 'Amethyst', hex: '#8a65c9' },
              { label: 'Crimson', hex: '#ba1a1a' },
              { label: 'Slate', hex: '#605c48' },
            ].map((preset) => {
              const isSelected = activeColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <motion.button
                  key={preset.hex}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.08 }}
                  onClick={() =>
                    onUpdateSettings({
                      accentColor: preset.hex,
                      customAccentColor: preset.hex,
                    })
                  }
                  title={preset.label}
                  className={`w-9 h-9 rounded-xl retro-border-sm flex items-center justify-center cursor-pointer shrink-0 transition-transform ${
                    isSelected ? 'retro-shadow-sm ring-2 ring-black/20 dark:ring-white/30' : ''
                  }`}
                  style={{ backgroundColor: preset.hex }}
                >
                  {isSelected && (
                    <span className="material-symbols-outlined text-white text-[18px]">check</span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Sleek Custom Color Picker Card Trigger */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-[#212019] rounded-xl retro-border-sm retro-shadow-sm">
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg retro-border-sm shadow-xs shrink-0"
                style={{ backgroundColor: activeColor }}
              />
              <div className="flex flex-col">
                <span className="font-sans text-xs font-bold text-[#1d1c11] dark:text-[#f6f1de]">
                  Interactive Color Picker
                </span>
                <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead]">
                  Updates app buttons, tabs & indicators live
                </span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => colorInputRef.current?.click()}
              className="h-8 px-3 rounded-lg bg-[#f3eedc] dark:bg-[#333128] retro-border-sm font-heading font-bold text-xs uppercase text-[#1d1c11] dark:text-[#f6f1de] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">colorize</span>
              <span>PICK COLOR</span>
            </motion.button>

            {/* Hidden native input picker */}
            <input
              ref={colorInputRef}
              type="color"
              value={activeColor}
              onChange={(e) =>
                onUpdateSettings({
                  accentColor: e.target.value,
                  customAccentColor: e.target.value,
                })
              }
              className="sr-only"
            />
          </div>
        </div>
      </div>

      {/* 2. READING PREFERENCES */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: 'var(--primary-red)' }}
          >
            auto_stories
          </span>
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
            Reading Preferences
          </h3>
        </div>

        {/* Default Zoom */}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block">Default Zoom Level</span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">Initial document display magnification</span>
          </div>
          <select
            value={settings.defaultZoom}
            onChange={(e) => onUpdateSettings({ defaultZoom: Number(e.target.value) })}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs retro-border-sm retro-shadow-sm cursor-pointer"
          >
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>
        </div>

        {/* Continuous Scroll Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
          <div>
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block">Continuous Scrolling</span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">Seamless vertical page transition stream</span>
          </div>
          <button
            onClick={() => onUpdateSettings({ continuousScroll: !settings.continuousScroll })}
            className={`w-12 h-7 rounded-full p-1 border-2 border-[#171717] transition-colors cursor-pointer ${
              settings.continuousScroll ? 'bg-[#249B65]' : 'bg-[#e7e2d1] dark:bg-[#474439]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white border border-[#171717] transition-transform ${
                settings.continuousScroll ? 'translate-x-5' : 'translate-x-0'
              }`}
            ></div>
          </button>
        </div>

        {/* Keep Screen Awake */}
        <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
          <div>
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block">Keep Screen Awake</span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead]">Prevent display timeout while reading documents</span>
          </div>
          <button
            onClick={() => onUpdateSettings({ keepScreenAwake: !settings.keepScreenAwake })}
            className={`w-12 h-7 rounded-full p-1 border-2 border-[#171717] transition-colors cursor-pointer ${
              settings.keepScreenAwake ? 'bg-[#249B65]' : 'bg-[#e7e2d1] dark:bg-[#474439]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white border border-[#171717] transition-transform ${
                settings.keepScreenAwake ? 'translate-x-5' : 'translate-x-0'
              }`}
            ></div>
          </button>
        </div>
      </div>

      {/* 3. FILE & STORAGE MANAGEMENT */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: 'var(--primary-red)' }}
          >
            sd_card
          </span>
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
            File & Storage Management
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClearCache}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">cleaning_services</span>
            <span>Clear Cache</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClearHistory}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">delete_history</span>
            <span>Clear History</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onExportBackup}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Data</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onImportBackup}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">upload</span>
            <span>Restore Data</span>
          </motion.button>
        </div>
      </div>

      {/* 4. PRIVACY & SECURITY */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2">
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ color: 'var(--primary-red)' }}
          >
            shield
          </span>
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
            Privacy & Security
          </h3>
        </div>

        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          MASTER DOCS is built with an absolute <strong>Zero-Cloud Guarantee</strong>. All document contents, bookmarks, reading history, and rendered pages remain encrypted strictly inside your local device storage (IndexedDB & Android Storage Access Framework). No documents are uploaded to external servers or AI services.
        </p>
      </div>

      {/* 5. ABOUT MASTER DOCS */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-3 text-center items-center">
        <div
          style={{ backgroundColor: 'var(--primary-red)' }}
          className="w-12 h-12 rounded-2xl text-white flex items-center justify-center retro-border-sm retro-shadow-sm mb-1 transition-colors"
        >
          <span className="material-symbols-outlined text-[28px]">menu_book</span>
        </div>
        <h2 className="font-heading font-bold text-lg text-[#1d1c11] dark:text-[#f6f1de]">
          MASTER DOCS
        </h2>
        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
          All-in-One Offline Document Reader for Android<br />
          Package ID: <code className="font-mono text-xs">com.masterdocs.reader</code>
        </p>
        <span className="px-3 py-1 rounded-full bg-[#e7e2d1] dark:bg-[#474439] font-heading font-bold text-[11px] uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm">
          Version 1.0.0 Stable Build
        </span>
      </div>
    </motion.div>
  );
};
