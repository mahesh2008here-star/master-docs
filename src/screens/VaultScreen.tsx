import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Delete,
  Plus,
  FolderInput,
  FolderOutput,
  Trash2,
  Settings2,
  HelpCircle,
  X,
  Check,
  ArrowLeft,
} from 'lucide-react';
import {
  DocumentItem,
  VaultLockType,
  VaultSecurityConfig,
} from '../types/document';
import {
  PRESET_SECURITY_QUESTIONS,
  setupVaultLock,
  verifyVaultSecret,
  verifySecurityAnswer,
  validateLockSecret,
} from '../services/vaultSecurityService';
import {
  getTypeBadgeConfig,
  formatFileSize,
  formatDateLabel,
} from '../utils/fileHelpers';
import { DocumentIcon } from '../components/common/DocumentIcon';

interface VaultScreenProps {
  vaultConfig: VaultSecurityConfig | null;
  isUnlocked: boolean;
  privateDocuments: DocumentItem[];
  publicDocuments: DocumentItem[];
  onVaultConfigUpdated: (config: VaultSecurityConfig) => void;
  onUnlock: () => void;
  onLock: () => void;
  onOpenDocument: (doc: DocumentItem) => void;
  onImportPrivateFile: () => void;
  onMoveToVault: (doc: DocumentItem) => Promise<void>;
  onRemoveFromVault: (id: string) => Promise<void>;
  onDeleteDocument: (id: string, e: React.MouseEvent) => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type VaultSubView = 'unlock' | 'recovery' | 'setup' | 'unlocked';

const PIN_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const VaultScreen: React.FC<VaultScreenProps> = ({
  vaultConfig,
  isUnlocked,
  privateDocuments,
  publicDocuments,
  onVaultConfigUpdated,
  onUnlock,
  onLock,
  onOpenDocument,
  onImportPrivateFile,
  onMoveToVault,
  onRemoveFromVault,
  onDeleteDocument,
  onNotify,
}) => {
  // Determine active view cleanly
  const [subView, setSubView] = useState<VaultSubView>(() => {
    if (!vaultConfig) return 'setup';
    return isUnlocked ? 'unlocked' : 'unlock';
  });

  useEffect(() => {
    if (!vaultConfig) {
      setSubView('setup');
    } else if (isUnlocked && subView !== 'setup') {
      setSubView('unlocked');
    } else if (!isUnlocked && subView === 'unlocked') {
      setSubView('unlock');
    }
  }, [vaultConfig, isUnlocked]);

  // --- UNLOCK SCREEN STATE ---
  const [unlockSecret, setUnlockSecret] = useState('');
  const [showUnlockPwd, setShowUnlockPwd] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(() => {
    if (vaultConfig?.lockoutUntil && Date.now() < vaultConfig.lockoutUntil) {
      return Math.ceil((vaultConfig.lockoutUntil - Date.now()) / 1000);
    }
    return 0;
  });
  const [verifyingUnlock, setVerifyingUnlock] = useState(false);

  // Sync lockout countdown every second
  useEffect(() => {
    if (vaultConfig?.lockoutUntil && Date.now() < vaultConfig.lockoutUntil) {
      setLockoutSeconds(Math.ceil((vaultConfig.lockoutUntil - Date.now()) / 1000));
    }
  }, [vaultConfig?.lockoutUntil]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutSeconds((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutSeconds]);

  // --- SETUP / CHANGE LOCK WIZARD STATE ---
  const [setupStep, setSetupStep] = useState<'secret' | 'confirm' | 'question'>('secret');
  const [lockType, setLockType] = useState<VaultLockType>(vaultConfig?.lockType || 'pin');
  const [draftSecret, setDraftSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [showDraftPwd, setShowDraftPwd] = useState(false);
  const [selectedQuestionPreset, setSelectedQuestionPreset] = useState<string>(
    PRESET_SECURITY_QUESTIONS[0]
  );
  const [customQuestion, setCustomQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [setupError, setSetupError] = useState<string | null>(null);
  const [savingSetup, setSavingSetup] = useState(false);

  // --- RECOVERY STATE (ANDROID SECURITY QUESTION RESET) ---
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // --- UNLOCKED VAULT MODAL STATE ---
  const [showMoveFromHomeModal, setShowMoveFromHomeModal] = useState(false);
  const [movingDocId, setMovingDocId] = useState<string | null>(null);

  const resetSetupWizard = (preferredType?: VaultLockType) => {
    setSetupStep('secret');
    setLockType(preferredType || vaultConfig?.lockType || 'pin');
    setDraftSecret('');
    setConfirmSecret('');
    setShowDraftPwd(false);
    setSelectedQuestionPreset(
      vaultConfig?.securityQuestion &&
        PRESET_SECURITY_QUESTIONS.includes(vaultConfig.securityQuestion as any)
        ? vaultConfig.securityQuestion
        : PRESET_SECURITY_QUESTIONS[0]
    );
    setCustomQuestion('');
    setSecurityAnswer('');
    setSetupError(null);
  };

  // Handle PIN/Password verification
  const handleSubmitUnlock = async (secretOverride?: string) => {
    const candidate = secretOverride ?? unlockSecret;
    if (lockoutSeconds > 0 || verifyingUnlock || !candidate) return;

    setVerifyingUnlock(true);
    setUnlockError(null);
    try {
      const result = await verifyVaultSecret(candidate);
      if (result.config) {
        onVaultConfigUpdated(result.config);
      }
      if (result.success) {
        setUnlockSecret('');
        setUnlockError(null);
        onUnlock();
      } else if (result.lockoutSeconds > 0) {
        setLockoutSeconds(result.lockoutSeconds);
        setUnlockSecret('');
        setUnlockError(`Too many wrong attempts. Try again in ${result.lockoutSeconds}s.`);
      } else {
        setUnlockSecret('');
        setUnlockError(
          `Incorrect ${vaultConfig?.lockType === 'password' ? 'password' : 'PIN'} • ${result.remainingAttempts} attempt(s) left`
        );
      }
    } finally {
      setVerifyingUnlock(false);
    }
  };

  const handlePinDigitPress = (digit: string) => {
    if (lockoutSeconds > 0) return;

    if (subView === 'unlock') {
      if (unlockSecret.length >= 8) return;
      setUnlockError(null);
      setUnlockSecret((prev) => prev + digit);
      return;
    }

    if (subView === 'setup') {
      setSetupError(null);
      if (setupStep === 'secret' && draftSecret.length < 8) {
        setDraftSecret((prev) => prev + digit);
      } else if (setupStep === 'confirm' && confirmSecret.length < 8) {
        setConfirmSecret((prev) => prev + digit);
      }
    }
  };

  const handlePinBackspace = () => {
    if (subView === 'unlock') {
      setUnlockSecret((prev) => prev.slice(0, -1));
      setUnlockError(null);
    } else if (subView === 'setup') {
      setSetupError(null);
      if (setupStep === 'secret') {
        setDraftSecret((prev) => prev.slice(0, -1));
      } else if (setupStep === 'confirm') {
        setConfirmSecret((prev) => prev.slice(0, -1));
      }
    }
  };

  const handleContinueSetupSecret = () => {
    const check = validateLockSecret(lockType, draftSecret);
    if (!check.valid) {
      setSetupError(check.error || 'Invalid credential.');
      return;
    }
    setSetupError(null);
    setConfirmSecret('');
    setSetupStep('confirm');
  };

  const handleContinueSetupConfirm = () => {
    if (confirmSecret !== draftSecret) {
      setSetupError(
        lockType === 'pin'
          ? 'PINs do not match. Re-enter the same PIN.'
          : 'Passwords do not match. Please try again.'
      );
      if (lockType === 'pin') setConfirmSecret('');
      return;
    }
    setSetupError(null);
    setSetupStep('question');
  };

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQuestion =
      selectedQuestionPreset === '__custom__' ? customQuestion.trim() : selectedQuestionPreset;
    setSavingSetup(true);
    setSetupError(null);
    try {
      const config = await setupVaultLock(lockType, draftSecret, finalQuestion, securityAnswer);
      onVaultConfigUpdated(config);
      onUnlock();
      setSubView('unlocked');
      setRecoveryVerified(false);
      setRecoveryAnswer('');
      onNotify(
        'success',
        vaultConfig
          ? 'Vault lock and security question updated.'
          : 'Secure Vault lock enabled!'
      );
    } catch (err: any) {
      setSetupError(err?.message || 'Unable to save vault security settings.');
    } finally {
      setSavingSetup(false);
    }
  };

  const handleVerifySecurityQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    const ok = await verifySecurityAnswer(recoveryAnswer);
    if (!ok) {
      setRecoveryError('Incorrect answer to your security question.');
      return;
    }
    setRecoveryVerified(true);
    resetSetupWizard(vaultConfig?.lockType || 'pin');
    setSubView('setup');
    onNotify('info', 'Identity verified. Set a new PIN or Password.');
  };

  // --- REUSABLE ANDROID NUMERIC KEYPAD ---
  const renderPinKeypad = (
    currentDigits: string,
    onConfirmTap: () => void,
    confirmLabel: string,
    disabled = false
  ) => (
    <div className="flex flex-col items-center gap-3 w-full max-w-[280px] mx-auto">
      {/* PIN Dot Indicators */}
      <div className="flex items-center justify-center gap-2.5 min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#212019] retro-border-sm w-full">
        {currentDigits.length === 0 ? (
          <span className="font-sans text-xs text-[#58413f]/70 dark:text-[#c8bead]/70">
            Enter 4–8 digit PIN
          </span>
        ) : (
          Array.from({ length: currentDigits.length }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="w-3.5 h-3.5 rounded-full border border-[#171717]"
            />
          ))
        )}
      </div>

      {/* 3x4 Android Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {PIN_DIGITS.map((digit) => (
          <motion.button
            key={digit}
            type="button"
            disabled={disabled}
            whileTap={{ scale: 0.92 }}
            onClick={() => handlePinDigitPress(digit)}
            className="h-12 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-lg tabular-nums retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-40 flex items-center justify-center hover:bg-[#f3eedc] dark:hover:bg-[#333128]"
          >
            {digit}
          </motion.button>
        ))}

        <motion.button
          type="button"
          disabled={disabled || currentDigits.length === 0}
          whileTap={{ scale: 0.92 }}
          onClick={handlePinBackspace}
          aria-label="Backspace"
          className="h-12 rounded-xl bg-[#ede8d6] dark:bg-[#3d3a30] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-40 flex items-center justify-center"
        >
          <Delete className="w-4 h-4" />
        </motion.button>

        <motion.button
          type="button"
          disabled={disabled}
          whileTap={{ scale: 0.92 }}
          onClick={() => handlePinDigitPress('0')}
          className="h-12 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-lg tabular-nums retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-40 flex items-center justify-center hover:bg-[#f3eedc] dark:hover:bg-[#333128]"
        >
          0
        </motion.button>

        <motion.button
          type="button"
          disabled={disabled || currentDigits.length < 4}
          whileTap={{ scale: 0.92 }}
          onClick={onConfirmTap}
          style={{
            backgroundColor: currentDigits.length >= 4 ? 'var(--primary-red)' : undefined,
          }}
          className={`h-12 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm cursor-pointer disabled:opacity-45 flex items-center justify-center ${
            currentDigits.length >= 4
              ? 'text-white'
              : 'bg-[#ede8d6] dark:bg-[#3d3a30] text-[#58413f] dark:text-[#c8bead]'
          }`}
        >
          {confirmLabel}
        </motion.button>
      </div>
    </div>
  );

  // =========================================================
  // 1. FIRST-TIME SETUP / RESET / CHANGE LOCK VIEW
  // =========================================================
  if (subView === 'setup') {
    const isChangingExisting = Boolean(vaultConfig) && (isUnlocked || recoveryVerified);

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col w-full space-y-4 pb-28 min-w-0"
      >
        <div className="flex items-center justify-between px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            {recoveryVerified
              ? 'RESET VAULT LOCK'
              : isChangingExisting
              ? 'UPDATE VAULT SECURITY'
              : 'CREATE SECURE VAULT'}
          </span>
          {isChangingExisting && (
            <button
              type="button"
              onClick={() => {
                if (isUnlocked) setSubView('unlocked');
                else setSubView('unlock');
              }}
              className="inline-flex items-center gap-1 font-heading font-bold text-xs text-[var(--primary-red)] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
        </div>

        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="w-11 h-11 rounded-xl retro-border flex items-center justify-center text-white shrink-0 retro-shadow-sm"
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de]">
                {setupStep === 'secret'
                  ? 'Set Screen Lock Method'
                  : setupStep === 'confirm'
                  ? `Confirm Your ${lockType === 'pin' ? 'PIN' : 'Password'}`
                  : 'Security Recovery Question'}
              </h2>
              <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
                {setupStep === 'question'
                  ? 'Used to reset your Vault PIN or Password if you ever forget it.'
                  : 'Private documents stay hidden from Home, Recent, Favourites, and Search.'}
              </p>
            </div>
          </div>

          {/* Step Indicator Bar */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'secret', label: '1. Lock Type' },
              { id: 'confirm', label: '2. Confirm' },
              { id: 'question', label: '3. Recovery' },
            ].map((s) => (
              <div
                key={s.id}
                className={`py-1.5 px-2 rounded-lg text-center font-heading font-bold text-[10px] uppercase tracking-wider retro-border-sm ${
                  setupStep === s.id
                    ? 'bg-[#1d1c11] text-[#fff9e7] dark:bg-[#f6f1de] dark:text-[#1d1c11]'
                    : 'bg-[#ede8d6] dark:bg-[#3d3a30] text-[#58413f] dark:text-[#c8bead]'
                }`}
              >
                {s.label}
              </div>
            ))}
          </div>

          {setupError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 retro-border-sm flex items-center gap-2 text-xs font-sans text-red-800 dark:text-red-200">
              <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--primary-red)]" />
              <span>{setupError}</span>
            </div>
          )}

          {setupStep === 'secret' && (
            <div className="flex flex-col gap-4">
              {/* PIN vs Password selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLockType('pin');
                    setDraftSecret('');
                    setConfirmSecret('');
                    setSetupError(null);
                  }}
                  style={{
                    backgroundColor: lockType === 'pin' ? 'var(--primary-red)' : undefined,
                  }}
                  className={`min-h-[42px] px-3 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                    lockType === 'pin'
                      ? 'text-white'
                      : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de]'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>PIN (Digits)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLockType('password');
                    setDraftSecret('');
                    setConfirmSecret('');
                    setSetupError(null);
                  }}
                  style={{
                    backgroundColor: lockType === 'password' ? 'var(--primary-red)' : undefined,
                  }}
                  className={`min-h-[42px] px-3 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
                    lockType === 'password'
                      ? 'text-white'
                      : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de]'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Password (Text)</span>
                </button>
              </div>

              {lockType === 'pin' ? (
                renderPinKeypad(draftSecret, handleContinueSetupSecret, 'NEXT')
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleContinueSetupSecret();
                  }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm">
                    <input
                      type={showDraftPwd ? 'text' : 'password'}
                      value={draftSecret}
                      onChange={(e) => {
                        setDraftSecret(e.target.value);
                        setSetupError(null);
                      }}
                      placeholder="Words, numbers, or symbols (min 4 chars)"
                      className="w-full bg-transparent text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDraftPwd((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="text-[#58413f] dark:text-[#c8bead] cursor-pointer"
                    >
                      {showDraftPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    style={{ backgroundColor: 'var(--primary-red)' }}
                    className="w-full min-h-[44px] rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer"
                  >
                    CONTINUE
                  </motion.button>
                </form>
              )}
            </div>
          )}

          {setupStep === 'confirm' && (
            <div className="flex flex-col gap-3">
              {lockType === 'pin' ? (
                renderPinKeypad(confirmSecret, handleContinueSetupConfirm, 'OK')
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleContinueSetupConfirm();
                  }}
                  className="flex flex-col gap-3"
                >
                  <input
                    type={showDraftPwd ? 'text' : 'password'}
                    value={confirmSecret}
                    onChange={(e) => {
                      setConfirmSecret(e.target.value);
                      setSetupError(null);
                    }}
                    placeholder="Re-enter your password..."
                    autoFocus
                    className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
                  />
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="submit"
                    style={{ backgroundColor: 'var(--primary-red)' }}
                    className="w-full min-h-[44px] rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer"
                  >
                    VERIFY &amp; CONTINUE
                  </motion.button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setSetupStep('secret');
                  setConfirmSecret('');
                  setSetupError(null);
                }}
                className="min-h-[38px] rounded-xl bg-[#ede8d6] dark:bg-[#3d3a30] text-[#58413f] dark:text-[#c8bead] font-heading font-bold text-xs uppercase retro-border-sm cursor-pointer"
              >
                Back to Edit {lockType === 'pin' ? 'PIN' : 'Password'}
              </button>
            </div>
          )}

          {setupStep === 'question' && (
            <form onSubmit={handleCompleteSetup} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-sans text-xs font-semibold text-[#58413f] dark:text-[#c8bead]">
                  Select Recovery Question
                </label>
                <select
                  value={selectedQuestionPreset}
                  onChange={(e) => setSelectedQuestionPreset(e.target.value)}
                  className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-xs font-sans font-medium text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
                >
                  {PRESET_SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="__custom__">Write a custom security question...</option>
                </select>
              </div>

              {selectedQuestionPreset === '__custom__' && (
                <div className="flex flex-col gap-1">
                  <label className="font-sans text-xs font-semibold text-[#58413f] dark:text-[#c8bead]">
                    Custom Question
                  </label>
                  <input
                    type="text"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="e.g. What was my first bike model?"
                    className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="font-sans text-xs font-semibold text-[#58413f] dark:text-[#c8bead]">
                  Security Answer (remember this for reset)
                </label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => {
                    setSecurityAnswer(e.target.value);
                    setSetupError(null);
                  }}
                  placeholder="Enter your recovery answer..."
                  className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSetupStep('confirm')}
                  className="min-h-[44px] px-4 rounded-xl bg-[#ede8d6] dark:bg-[#3d3a30] text-[#58413f] dark:text-[#c8bead] font-heading font-bold text-xs uppercase retro-border-sm cursor-pointer"
                >
                  Back
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={savingSetup}
                  style={{ backgroundColor: 'var(--primary-red)' }}
                  className="flex-1 min-h-[44px] rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingSetup ? 'SECURING...' : 'SAVE & OPEN VAULT'}</span>
                </motion.button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    );
  }

  // =========================================================
  // 2. FORGOT PIN / PASSWORD — SECURITY QUESTION RECOVERY
  // =========================================================
  if (subView === 'recovery' && vaultConfig) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col w-full space-y-4 pb-28 min-w-0"
      >
        <div className="flex items-center justify-between px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            RESET VAULT ACCESS
          </span>
          <button
            type="button"
            onClick={() => {
              setRecoveryError(null);
              setRecoveryAnswer('');
              setSubView('unlock');
            }}
            className="inline-flex items-center gap-1 font-heading font-bold text-xs text-[var(--primary-red)] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Lock</span>
          </button>
        </div>

        <form
          onSubmit={handleVerifySecurityQuestion}
          className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 retro-border retro-shadow flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="w-11 h-11 rounded-xl retro-border flex items-center justify-center text-white shrink-0 retro-shadow-sm"
            >
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de]">
                Answer Security Question
              </h2>
              <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
                Verify your identity to reset your Vault {vaultConfig.lockType === 'pin' ? 'PIN' : 'Password'}.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm">
            <span className="font-heading font-bold text-[10px] uppercase tracking-wider text-[#58413f] dark:text-[#c8bead] block mb-1">
              Your Security Question:
            </span>
            <p className="font-sans font-semibold text-sm text-[#1d1c11] dark:text-[#f6f1de]">
              {vaultConfig.securityQuestion}
            </p>
          </div>

          {recoveryError && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 retro-border-sm flex items-center gap-2 text-xs font-sans text-red-800 dark:text-red-200">
              <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--primary-red)]" />
              <span>{recoveryError}</span>
            </div>
          )}

          <input
            type="text"
            value={recoveryAnswer}
            onChange={(e) => {
              setRecoveryAnswer(e.target.value);
              setRecoveryError(null);
            }}
            placeholder="Type your security answer..."
            autoFocus
            className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
          />

          <motion.button
            whileTap={{ scale: 0.96 }}
            type="submit"
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-full min-h-[44px] rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow cursor-pointer"
          >
            VERIFY ANSWER &amp; RESET LOCK
          </motion.button>
        </form>
      </motion.div>
    );
  }

  // =========================================================
  // 3. ANDROID SCREEN LOCK PROMPT (WHEN LOCKED)
  // =========================================================
  if (!isUnlocked && vaultConfig) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col w-full space-y-4 pb-28 min-w-0"
      >
        <div className="flex items-center justify-between px-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[11px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
            SECURE VAULT LOCKED
          </span>
          <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] tabular-nums">
            {privateDocuments.length} hidden file(s)
          </span>
        </div>

        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-5 sm:p-6 retro-border retro-shadow flex flex-col items-center gap-4">
          <div
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-14 h-14 rounded-2xl retro-border flex items-center justify-center text-white retro-shadow-sm"
          >
            <Lock className="w-7 h-7" />
          </div>

          <div className="text-center">
            <h2 className="font-heading font-bold text-lg text-[#1d1c11] dark:text-[#f6f1de]">
              {vaultConfig.lockType === 'pin' ? 'Enter Vault PIN' : 'Enter Vault Password'}
            </h2>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mt-0.5">
              Unlock to view and manage your private documents
            </p>
          </div>

          {(unlockError || lockoutSeconds > 0) && (
            <div className="w-full max-w-xs p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 retro-border-sm flex items-center justify-center gap-2 text-xs font-sans text-red-800 dark:text-red-200 text-center">
              <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--primary-red)]" />
              <span className="tabular-nums">
                {lockoutSeconds > 0
                  ? `Locked out after wrong tries. Wait ${lockoutSeconds}s.`
                  : unlockError}
              </span>
            </div>
          )}

          {vaultConfig.lockType === 'pin' ? (
            renderPinKeypad(
              unlockSecret,
              () => handleSubmitUnlock(),
              'OPEN',
              lockoutSeconds > 0 || verifyingUnlock
            )
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitUnlock();
              }}
              className="w-full max-w-xs flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm">
                <input
                  type={showUnlockPwd ? 'text' : 'password'}
                  disabled={lockoutSeconds > 0}
                  value={unlockSecret}
                  onChange={(e) => {
                    setUnlockSecret(e.target.value);
                    setUnlockError(null);
                  }}
                  placeholder="Enter Vault password..."
                  autoFocus
                  className="w-full bg-transparent text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockPwd((v) => !v)}
                  aria-label="Show or hide password"
                  className="text-[#58413f] dark:text-[#c8bead] cursor-pointer"
                >
                  {showUnlockPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                type="submit"
                disabled={lockoutSeconds > 0 || verifyingUnlock || !unlockSecret}
                style={{ backgroundColor: 'var(--primary-red)' }}
                className="w-full min-h-[44px] rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                <span>{verifyingUnlock ? 'CHECKING...' : 'UNLOCK VAULT'}</span>
              </motion.button>
            </form>
          )}

          <button
            type="button"
            onClick={() => {
              setRecoveryAnswer('');
              setRecoveryError(null);
              setSubView('recovery');
            }}
            className="mt-1 px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider text-[var(--primary-red)] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Forgot {vaultConfig.lockType === 'pin' ? 'PIN' : 'Password'}?</span>
          </button>
        </div>
      </motion.div>
    );
  }

  // =========================================================
  // 4. UNLOCKED SECURE VAULT MANAGER
  // =========================================================
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col w-full space-y-4 pb-28 min-w-0"
    >
      {/* Top Vault Control Bar */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#249B65] retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider truncate">
                Private Document Vault
              </h2>
              <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] tabular-nums">
                {privateDocuments.length} hidden file(s) • Removed from public storage • Auto-locks on exit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                resetSetupWizard();
                setSubView('setup');
              }}
              title="Change Lock or Security Question"
              className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm retro-shadow-sm flex items-center gap-1.5 font-heading font-bold text-[11px] uppercase cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock Settings</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onLock}
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="min-h-[38px] px-3 rounded-xl text-white retro-border-sm retro-shadow-sm flex items-center gap-1.5 font-heading font-bold text-[11px] uppercase cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock</span>
            </motion.button>
          </div>
        </div>

        {/* Vault Import & Hide Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onImportPrivateFile}
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="min-h-[44px] px-3.5 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>ADD PRIVATE DOCUMENT</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowMoveFromHomeModal(true)}
            className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128]"
          >
            <FolderInput className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
            <span>HIDE EXISTING DOC HERE</span>
          </motion.button>
        </div>
      </div>

      {/* Private Documents List */}
      {privateDocuments.length === 0 ? (
        <div className="p-8 text-center bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow flex flex-col items-center gap-2">
          <Lock className="w-10 h-10 text-[#58413f]/50 dark:text-[#c8bead]/50" />
          <h3 className="font-heading font-bold text-base text-[#1d1c11] dark:text-[#f6f1de]">
            Your Private Vault Is Empty
          </h3>
          <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] max-w-xs leading-relaxed">
            Import sensitive PDFs, IDs, or documents directly above, or move any document from your Home screen into this PIN-protected vault.
          </p>
        </div>
      ) : (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl retro-border retro-shadow overflow-hidden divide-y-2 divide-[#171717] dark:divide-[#38352b]">
          {privateDocuments.map((doc) => {
            const badge = getTypeBadgeConfig(doc.type, doc.extension);
            return (
              <motion.div
                key={doc.id}
                whileTap={{ scale: 0.99 }}
                onClick={() => onOpenDocument(doc)}
                className="p-3.5 flex items-center justify-between gap-2.5 hover:bg-[#f3eedc] dark:hover:bg-[#333128] transition-colors cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0 retro-shadow-sm`}
                  >
                    <DocumentIcon typeKey={badge.typeKey} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block font-heading font-bold text-xs sm:text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {doc.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      <span className="px-1.5 py-0.2 rounded bg-[#e7e2d1] dark:bg-[#474439] retro-border-sm font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] font-bold uppercase shrink-0">
                        {badge.label}
                      </span>
                      <span className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] truncate tabular-nums">
                        {formatFileSize(doc.size)} • {formatDateLabel(doc.modifiedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1.5 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => onRemoveFromVault(doc.id)}
                    title="Unhide & Move Back to Home"
                    aria-label="Move back to Home"
                    className="w-10 h-10 rounded-xl bg-white dark:bg-[#212019] retro-border-sm retro-shadow-sm flex items-center justify-center text-[#249B65] cursor-pointer"
                  >
                    <FolderOutput className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={(e) => onDeleteDocument(doc.id, e)}
                    title="Delete Permanently"
                    aria-label="Delete private document"
                    className="w-10 h-10 rounded-xl bg-white dark:bg-[#212019] retro-border-sm retro-shadow-sm flex items-center justify-center text-[var(--primary-red)] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Move Existing Home Document into Secure Vault Modal */}
      <AnimatePresence>
        {showMoveFromHomeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md max-h-[80vh] bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow-lg flex flex-col gap-3"
            >
              <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2.5">
                <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de]">
                  Select Document to Hide in Vault
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMoveFromHomeModal(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-center text-[#1d1c11] dark:text-[#f6f1de] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-black/10 dark:divide-white/10">
                {publicDocuments.length === 0 ? (
                  <p className="py-6 text-center font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
                    No public documents found on Home right now.
                  </p>
                ) : (
                  publicDocuments.map((doc) => {
                    const badge = getTypeBadgeConfig(doc.type, doc.extension);
                    const busy = movingDocId === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="py-2.5 flex items-center justify-between gap-2 min-w-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-lg ${badge.bgColor} retro-border-sm flex items-center justify-center text-white shrink-0`}
                          >
                            <DocumentIcon typeKey={badge.typeKey} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] truncate">
                              {doc.name}
                            </span>
                            <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] tabular-nums">
                              {badge.label} • {formatFileSize(doc.size)}
                            </span>
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          disabled={busy}
                          onClick={async () => {
                            setMovingDocId(doc.id);
                            try {
                              await onMoveToVault(doc);
                            } finally {
                              setMovingDocId(null);
                            }
                          }}
                          style={{ backgroundColor: 'var(--primary-red)' }}
                          className="min-h-[34px] px-3 rounded-lg text-white font-heading font-bold text-[10px] uppercase retro-border-sm shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {busy ? 'LOCKING...' : 'HIDE'}
                        </motion.button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
