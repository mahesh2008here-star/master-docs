import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Monitor, 
  Check, 
  Pipette, 
  BookOpen, 
  HardDrive, 
  Trash2, 
  History, 
  Download, 
  Upload, 
  ShieldCheck 
} from 'lucide-react';
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
      className="flex flex-col w-full space-y-4 pb-28 min-w-0"
    >
      {/* Header Badge */}
      <div className="flex items-center justify-between px-1 min-w-0">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          APPLICATION SETTINGS
        </span>
        <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">v1.0.0 Stable</span>
      </div>

      {/* 1. APPEARANCE & MATERIAL COLOR SECTION */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2 min-w-0">
          <Palette className="w-5 h-5 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Appearance & Themes
          </h3>
        </div>

        {/* Theme mode toggle */}
        <div className="flex flex-col gap-2 min-w-0">
          <label className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">
            Interface Theme
          </label>
          <div className="grid grid-cols-3 gap-2 min-w-0">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark Ink', icon: Moon },
              { id: 'system', label: 'System', icon: Monitor },
            ].map((t) => {
              const isActive = settings.themeMode === t.id;
              const IconComp = t.icon;
              return (
                <motion.button
                  key={t.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onUpdateSettings({ themeMode: t.id as any })}
                  style={{
                    backgroundColor: isActive ? 'var(--primary-red)' : undefined,
                  }}
                  className={`h-11 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm cursor-pointer flex items-center justify-center gap-1.5 transition-colors min-w-0 ${
                    isActive
                      ? 'text-white retro-shadow-sm'
                      : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de]'
                  }`}
                >
                  <IconComp className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* CUSTOM MATERIAL ACCENT COLOR SECTION */}
        <div className="flex flex-col gap-3 pt-3 border-t border-black/10 dark:border-white/10 min-w-0">
          <div className="flex items-center justify-between">
            <label className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">
              Material Accent Color
            </label>
            <span className="font-mono text-xs font-bold text-[#58413f] dark:text-[#c8bead] uppercase">
              {activeColor}
            </span>
          </div>

          {/* Swatches List */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0 min-w-0">
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
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </motion.button>
              );
            })}
          </div>

          {/* Color Picker Card Trigger */}
          <div className="flex items-center justify-between p-3 bg-white dark:bg-[#212019] rounded-xl retro-border-sm retro-shadow-sm gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className="w-7 h-7 rounded-lg retro-border-sm shadow-xs shrink-0"
                style={{ backgroundColor: activeColor }}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-sans text-xs font-bold text-[#1d1c11] dark:text-[#f6f1de] truncate">
                  Interactive Color Picker
                </span>
                <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] truncate">
                  Updates buttons & indicators live
                </span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => colorInputRef.current?.click()}
              className="h-8 px-3 rounded-lg bg-[#f3eedc] dark:bg-[#333128] retro-border-sm font-heading font-bold text-xs uppercase text-[#1d1c11] dark:text-[#f6f1de] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Pipette className="w-3.5 h-3.5" />
              <span>PICK COLOR</span>
            </motion.button>

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
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2 min-w-0">
          <BookOpen className="w-5 h-5 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Reading Preferences
          </h3>
        </div>

        {/* Default Zoom */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">Default Zoom Level</span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">Initial document magnification</span>
          </div>
          <select
            value={settings.defaultZoom}
            onChange={(e) => onUpdateSettings({ defaultZoom: Number(e.target.value) })}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs retro-border-sm retro-shadow-sm cursor-pointer shrink-0"
          >
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>
        </div>

        {/* Continuous Scroll Toggle */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">Continuous Scrolling</span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">Seamless page stream</span>
          </div>
          <button
            onClick={() => onUpdateSettings({ continuousScroll: !settings.continuousScroll })}
            className={`w-12 h-7 rounded-full p-1 border-2 border-[#171717] transition-colors cursor-pointer shrink-0 ${
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
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">Keep Screen Awake</span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">Prevent display timeout</span>
          </div>
          <button
            onClick={() => onUpdateSettings({ keepScreenAwake: !settings.keepScreenAwake })}
            className={`w-12 h-7 rounded-full p-1 border-2 border-[#171717] transition-colors cursor-pointer shrink-0 ${
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
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2 min-w-0">
          <HardDrive className="w-5 h-5 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Storage & Data
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 min-w-0">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClearCache}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-w-0"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span className="truncate">Clear Cache</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClearHistory}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-w-0"
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="truncate">Clear History</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onExportBackup}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-w-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="truncate">Export Data</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onImportBackup}
            className="h-11 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer min-w-0"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">Restore Data</span>
          </motion.button>
        </div>
      </div>

      {/* 4. PRIVACY & SECURITY */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2 min-w-0">
          <ShieldCheck className="w-5 h-5 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Privacy & Security
          </h3>
        </div>

        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          MASTER DOCS is built with an absolute <strong>Zero-Cloud Guarantee</strong>. All document contents, bookmarks, reading history, and rendered pages remain encrypted strictly inside your local device storage (IndexedDB & Android Storage Access Framework). No documents are uploaded to external servers or AI services.
        </p>
      </div>

      {/* 5. ABOUT MASTER DOCS */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-2.5 text-center items-center min-w-0">
        <div
          style={{ backgroundColor: 'var(--primary-red)' }}
          className="w-12 h-12 rounded-2xl text-white flex items-center justify-center retro-border-sm retro-shadow-sm mb-1 transition-colors shrink-0"
        >
          <BookOpen className="w-6 h-6" />
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
