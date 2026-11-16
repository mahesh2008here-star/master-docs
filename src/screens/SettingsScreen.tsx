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
  ShieldCheck,
  FolderSync,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { AppSettings } from '../types/document';

interface SettingsScreenProps {
  settings: AppSettings;
  contributorsCount?: number;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSupport: () => void;
  onClearAllDocuments: () => void;
  onClearHistory: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onSeedDemoDocs?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  contributorsCount = 0,
  onUpdateSettings,
  onOpenSupport,
  onClearAllDocuments,
  onClearHistory,
  onExportBackup,
  onImportBackup,
  onSeedDemoDocs,
}) => {
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const activeColor = settings.customAccentColor || settings.accentColor || '#a92f2e';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-4 pb-28 min-w-0"
    >
      <div className="flex items-center justify-between px-1 min-w-0">
        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          APPLICATION SETTINGS
        </span>
      </div>

      {/* 1. APPEARANCE & MATERIAL COLOR SECTION */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2.5 min-w-0">
          <Palette className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Appearance &amp; Themes
          </h3>
        </div>

        {/* Theme mode toggle */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="font-sans text-xs font-semibold text-[#58413f] dark:text-[#c8bead]">
            Interface Theme
          </span>
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
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onUpdateSettings({ themeMode: t.id as AppSettings['themeMode'] })}
                  style={{
                    backgroundColor: isActive ? 'var(--primary-red)' : undefined,
                  }}
                  className={`min-h-[42px] rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-colors min-w-0 ${
                    isActive
                      ? 'text-white'
                      : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] hover:bg-[#f3eedc] dark:hover:bg-[#333128]'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* CUSTOM MATERIAL ACCENT COLOR SECTION */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-black/10 dark:border-white/10 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-sans text-xs font-semibold text-[#58413f] dark:text-[#c8bead]">
              Material Accent Color
            </span>
            <span className="font-mono text-[11px] font-bold text-[#58413f] dark:text-[#c8bead] uppercase">
              {activeColor}
            </span>
          </div>

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
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    onUpdateSettings({
                      accentColor: preset.hex,
                      customAccentColor: preset.hex,
                    })
                  }
                  title={preset.label}
                  aria-label={`Select ${preset.label} accent color`}
                  className={`w-10 h-10 rounded-xl retro-border-sm flex items-center justify-center cursor-pointer shrink-0 ${
                    isSelected ? 'retro-shadow ring-2 ring-[#171717] dark:ring-[#f6f1de]' : ''
                  }`}
                  style={{ backgroundColor: preset.hex }}
                >
                  {isSelected && <Check className="w-4 h-4 text-white" />}
                </motion.button>
              );
            })}
          </div>

          <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#212019] rounded-xl retro-border-sm gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div
                className="w-7 h-7 rounded-lg retro-border-sm shrink-0"
                style={{ backgroundColor: activeColor }}
              />
              <div className="flex flex-col min-w-0">
                <span className="font-heading text-xs font-bold text-[#1d1c11] dark:text-[#f6f1de] truncate">
                  Custom Color Picker
                </span>
                <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] truncate">
                  Updates highlights &amp; primary buttons live
                </span>
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => colorInputRef.current?.click()}
              className="min-h-[38px] px-3 rounded-lg bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] uppercase text-[#1d1c11] dark:text-[#f6f1de] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Pipette className="w-3.5 h-3.5 text-[var(--primary-red)]" />
              <span>Pick</span>
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
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-3.5 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2.5 min-w-0">
          <BookOpen className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Reading Preferences
          </h3>
        </div>

        {/* Default Zoom */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">
              Default Zoom Level
            </span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">
              Initial magnification for opening documents
            </span>
          </div>
          <select
            value={settings.defaultZoom}
            onChange={(e) => onUpdateSettings({ defaultZoom: Number(e.target.value) })}
            className="min-h-[38px] px-2.5 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs retro-border-sm cursor-pointer shrink-0 tabular-nums"
          >
            <option value={85}>85%</option>
            <option value={100}>100%</option>
            <option value={115}>115%</option>
            <option value={130}>130%</option>
          </select>
        </div>

        {/* Page Spacing */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">
              Page Padding &amp; Spacing
            </span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">
              Controls reader sheet margin density
            </span>
          </div>
          <select
            value={settings.pageSpacing}
            onChange={(e) =>
              onUpdateSettings({ pageSpacing: e.target.value as AppSettings['pageSpacing'] })
            }
            className="min-h-[38px] px-2.5 rounded-lg bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs retro-border-sm cursor-pointer shrink-0"
          >
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </div>

        {/* Continuous Scroll Toggle */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">
              Continuous PDF Scrolling
            </span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">
              Scroll seamlessly through all PDF pages
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.continuousScroll}
            onClick={() => onUpdateSettings({ continuousScroll: !settings.continuousScroll })}
            aria-label="Toggle continuous scrolling"
            className={`w-12 h-7 rounded-full p-0.5 border-2 border-[#171717] transition-colors cursor-pointer shrink-0 flex items-center ${
              settings.continuousScroll ? 'bg-[#249B65]' : 'bg-[#e7e2d1] dark:bg-[#474439]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white border border-[#171717] transition-transform ${
                settings.continuousScroll ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Keep Screen Awake */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10 min-w-0">
          <div className="min-w-0 flex-1">
            <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] block truncate">
              Keep Screen Awake
            </span>
            <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate block">
              Prevent dimming via Wake Lock while reading
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.keepScreenAwake}
            onClick={() => onUpdateSettings({ keepScreenAwake: !settings.keepScreenAwake })}
            aria-label="Toggle keep screen awake"
            className={`w-12 h-7 rounded-full p-0.5 border-2 border-[#171717] transition-colors cursor-pointer shrink-0 flex items-center ${
              settings.keepScreenAwake ? 'bg-[#249B65]' : 'bg-[#e7e2d1] dark:bg-[#474439]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white border border-[#171717] transition-transform ${
                settings.keepScreenAwake ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2.5 SUPPORT MASTER DOCS (Middle Highlighted Entry) */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={onOpenSupport}
        className="w-full text-left bg-[#f9f4e1] dark:bg-[#2b2921] bg-paper-dots rounded-2xl p-4 retro-border retro-shadow flex items-center justify-between gap-3 cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors min-w-0"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-11 h-11 rounded-xl retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm"
          >
            <Heart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
              Support MASTER DOCS
            </h3>
            <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate tabular-nums">
              Pay via UPI or QR · ₹50+ joins Verified Contributors ({contributorsCount})
            </p>
          </div>
        </div>
        <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[var(--primary-red)] shrink-0">
          <ChevronRight className="w-4 h-4" />
        </div>
      </motion.button>

      {/* 3. FILE & STORAGE MANAGEMENT */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2.5 min-w-0">
          <HardDrive className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
          <h3 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
            Storage &amp; Data
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 min-w-0">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClearAllDocuments}
            className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128] min-w-0"
          >
            <Trash2 className="w-3.5 h-3.5 text-[var(--primary-red)] shrink-0" />
            <span className="truncate">Clear Vault</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onClearHistory}
            className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128] min-w-0"
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Clear History</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onExportBackup}
            className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128] min-w-0"
          >
            <Download className="w-3.5 h-3.5 text-[#249B65] shrink-0" />
            <span className="truncate">Export Vault</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onImportBackup}
            className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128] min-w-0"
          >
            <Upload className="w-3.5 h-3.5 text-[#3478D4] shrink-0" />
            <span className="truncate">Restore Vault</span>
          </motion.button>
        </div>

        {onSeedDemoDocs && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onSeedDemoDocs}
            className="min-h-[44px] px-4 rounded-xl bg-[#ede8d6] dark:bg-[#3d3a30] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:bg-[#e5dfc9] dark:hover:bg-[#49453a] w-full"
          >
            <FolderSync className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
            <span>LOAD SAMPLE DEMO DOCUMENTS</span>
          </motion.button>
        )}
      </div>

      {/* 4. PRIVACY GUARANTEE */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 text-[#249B65]">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <h3 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
            Privacy &amp; Offline Guarantee
          </h3>
        </div>
        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          MASTER DOCS operates <strong>100% locally on your device</strong>. Imported files, bookmarks, and reading sessions stay strictly in on-device IndexedDB storage without uploading your documents.
        </p>
      </div>

      {/* 5. ABOUT MASTER DOCS */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow flex flex-col items-center text-center gap-2 min-w-0">
        <div
          style={{ backgroundColor: 'var(--primary-red)' }}
          className="w-12 h-12 rounded-2xl retro-border flex items-center justify-center text-white retro-shadow-sm"
        >
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
          MASTER DOCS
        </h3>
        <span className="inline-block px-3 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
          Version 1.0.0 Stable Build
        </span>
        <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mt-1">
          Offline Android Reader · <code className="font-mono text-[11px]">com.masterdocs.reader</code>
        </p>
      </div>
    </motion.div>
  );
};
