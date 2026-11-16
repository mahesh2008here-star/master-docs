import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import QRCode from 'qrcode';
import {
  Heart,
  QrCode,
  Smartphone,
  Copy,
  Check,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  ArrowLeft,
  Mail,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MessageSquareHeart,
} from 'lucide-react';
import { ContributorEntry } from '../types/document';
import {
  SUPPORT_UPI_ID,
  OWNER_GMAIL_ADDRESS,
  MIN_CONTRIBUTION_FOR_LIST_INR,
  buildUpiPaymentUri,
  submitContributionForApproval,
  getLocalPendingSubmissions,
  saveLocalPendingSubmissions,
  fetchContributionStatuses,
  fetchReviewRequestInfo,
  submitOwnerDecision,
  type PendingLocalSubmission,
  type ReviewRequestDetails,
} from '../services/supportService';
import { launchUpiPaymentIntent } from '../services/nativeStorageService';
import { formatDateLabel } from '../utils/fileHelpers';

export interface SupportReviewParams {
  id: string;
  action: 'approve' | 'reject';
  token: string;
}

interface SupportScreenProps {
  contributors: ContributorEntry[];
  reviewParams?: SupportReviewParams | null;
  onClearReviewParams?: () => void;
  onContributorApproved: (entry: ContributorEntry) => void;
  onRefreshContributors: () => Promise<void>;
  onBack: () => void;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

const AMOUNT_PRESETS = [20, 50, 100, 250, 500];

export const SupportScreen: React.FC<SupportScreenProps> = ({
  contributors,
  reviewParams,
  onClearReviewParams,
  onContributorApproved,
  onRefreshContributors,
  onBack,
  onNotify,
}) => {
  const [amountInput, setAmountInput] = useState<string>('50');
  const [paymentTab, setPaymentTab] = useState<'qr' | 'upi'>('qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Payment submission form state
  const [supporterName, setSupporterName] = useState('');
  const [utrReference, setUtrReference] = useState('');
  const [supporterNote, setSupporterNote] = useState('');
  const [paymentConfirmedCheck, setPaymentConfirmedCheck] = useState(false);
  const [paymentInitiatedAt, setPaymentInitiatedAt] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pendingMailtoFallback, setPendingMailtoFallback] = useState<string | null>(null);
  const [pendingList, setPendingList] = useState<PendingLocalSubmission[]>(() =>
    getLocalPendingSubmissions()
  );

  // Email review mode (?reviewContribution=...&action=...&token=...)
  const [reviewDetails, setReviewDetails] = useState<ReviewRequestDetails | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewThankYouNote, setReviewThankYouNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const numericAmount = useMemo(() => {
    const parsed = Math.floor(Number(amountInput));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [amountInput]);

  const upiUri = useMemo(
    () => buildUpiPaymentUri(Math.max(1, numericAmount || 50), supporterName),
    [numericAmount, supporterName]
  );

  // Load details when opened from Gmail Approve/Reject button link
  useEffect(() => {
    if (!reviewParams?.id || !reviewParams?.token) {
      setReviewDetails(null);
      return;
    }
    let active = true;
    setReviewLoading(true);
    setReviewError(null);
    fetchReviewRequestInfo(reviewParams.id, reviewParams.token)
      .then((details) => {
        if (!active) return;
        setReviewDetails(details);
        setReviewThankYouNote(
          details.thankYouNote ||
            `Thank you so much, ${details.name}, for supporting MASTER DOCS!`
        );
      })
      .catch((err: any) => {
        if (active) setReviewError(err?.message || 'Unable to load payment request.');
      })
      .finally(() => {
        if (active) setReviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reviewParams]);

  // Poll pending submission statuses so contributor sees approval/rejection live
  useEffect(() => {
    const activePending = pendingList.filter((p) => p.status === 'pending');
    if (activePending.length === 0) return;

    let cancelled = false;
    const checkStatuses = async () => {
      try {
        const statuses = await fetchContributionStatuses(activePending.map((p) => p.id));
        if (cancelled || !statuses) return;
        let changed = false;
        let approvedAny = false;
        const updated = pendingList
          .map((item) => {
            const serverInfo = statuses[item.id];
            if (serverInfo && serverInfo.status !== item.status) {
              changed = true;
              if (serverInfo.status === 'approved') approvedAny = true;
              return {
                ...item,
                status: serverInfo.status,
                thankYouNote: serverInfo.thankYouNote,
              };
            }
            return item;
          })
          // Drop rejected silently so app stays as it was
          .filter((item) => item.status !== 'rejected');

        if (changed) {
          setPendingList(updated);
          saveLocalPendingSubmissions(updated);
          if (approvedAny) {
            await onRefreshContributors();
            onNotify('success', 'Your contribution was approved by the owner! Thank you!');
          }
        }
      } catch {
        // Offline / server unreachable; keep pending state silently
      }
    };

    void checkStatuses();
    const timer = window.setInterval(checkStatuses, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingList, onRefreshContributors, onNotify]);

  // Generate offline scannable NPCI UPI QR code
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(upiUri, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#171717',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [upiUri]);

  const handleCopyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_UPI_ID);
      setCopiedUpi(true);
      onNotify('success', `Copied UPI ID: ${SUPPORT_UPI_ID}`);
      setTimeout(() => setCopiedUpi(false), 1800);
    } catch {
      onNotify('info', `UPI ID: ${SUPPORT_UPI_ID}`);
    }
  };

  const handleLaunchUpiApp = async () => {
    if (numericAmount < 1) {
      onNotify('error', 'Enter an amount of ₹1 or more.');
      return;
    }
    setPaymentInitiatedAt(Date.now());
    const res = await launchUpiPaymentIntent(upiUri);
    if (res.launched) {
      onNotify('info', 'After completing payment, submit your 12-digit UTR below for review.');
    } else {
      onNotify('error', res.error || 'Could not open UPI app. Scan the QR code instead.');
    }
  };

  const handleSubmitForApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setPendingMailtoFallback(null);

    if (numericAmount < MIN_CONTRIBUTION_FOR_LIST_INR) {
      setSubmitError(
        `You can support with any amount, however ₹${MIN_CONTRIBUTION_FOR_LIST_INR} or more is mandatory to appear on the Contributors List.`
      );
      return;
    }

    if (!paymentConfirmedCheck) {
      setSubmitError('Please confirm that you completed the UPI payment to masterdocs@ibl.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitContributionForApproval({
        name: supporterName,
        amount: numericAmount,
        utr: utrReference,
        note: supporterNote,
      });

      setPendingList(getLocalPendingSubmissions());
      setSupporterName('');
      setUtrReference('');
      setSupporterNote('');
      setPaymentConfirmedCheck(false);
      setPaymentInitiatedAt(null);

      if (result.emailSent) {
        onNotify(
          'success',
          `Sent to ${OWNER_GMAIL_ADDRESS} for payment check! You will appear once approved.`
        );
      } else {
        setPendingMailtoFallback(result.mailtoUrl);
        onNotify(
          'info',
          `Opening Gmail to send verification details to ${OWNER_GMAIL_ADDRESS}...`
        );
        if (result.mailtoUrl) {
          window.setTimeout(() => {
            window.location.href = result.mailtoUrl;
          }, 150);
        }
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Submission failed. Check your UTR and connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmEmailDecision = async (action: 'approve' | 'reject') => {
    if (!reviewParams || !reviewDetails) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const decisionRes = await submitOwnerDecision({
        id: reviewParams.id,
        token: reviewParams.token,
        action,
        thankYouNote: action === 'approve' ? reviewThankYouNote : undefined,
      });

      if (action === 'approve' && decisionRes.entry) {
        onContributorApproved(decisionRes.entry);
        await onRefreshContributors();
        onNotify(
          'success',
          `Approved ${decisionRes.entry.name} (₹${decisionRes.entry.amount}) with Thank You note!`
        );
      } else {
        onNotify('info', 'Payment rejected. Contributors list left unchanged.');
      }

      setReviewDetails((prev) =>
        prev ? { ...prev, status: action === 'approve' ? 'approved' : 'rejected' } : null
      );
      onClearReviewParams?.();
    } catch (err: any) {
      setReviewError(err?.message || 'Failed processing review decision.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const meetsListMinimum = numericAmount >= MIN_CONTRIBUTION_FOR_LIST_INR;
  const activePendingItems = pendingList.filter((p) => p.status === 'pending');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col w-full space-y-4 pb-28 min-w-0"
    >
      {/* Back Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3 rounded-xl bg-[#f9f4e1] dark:bg-[#2b2921] retro-border-sm retro-shadow-sm inline-flex items-center gap-1.5 font-heading font-bold text-xs uppercase tracking-wider text-[#1d1c11] dark:text-[#f6f1de] cursor-pointer hover:bg-[#f3eedc] dark:hover:bg-[#333128]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Settings</span>
        </button>

        <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider retro-shadow-sm">
          SUPPORT &amp; CONTRIBUTORS
        </span>
      </div>

      {/* ================================================================= */}
      {/* OWNER EMAIL REVIEW CARD (Opened from Gmail Approve / Reject link) */}
      {/* ================================================================= */}
      {(reviewParams || reviewDetails) && (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
              <h2 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
                Gmail Payment Verification
              </h2>
            </div>
            {onClearReviewParams && (
              <button
                type="button"
                onClick={onClearReviewParams}
                className="font-heading font-bold text-[11px] uppercase text-[var(--primary-red)] cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>

          {reviewLoading ? (
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead]">
              Loading payment details...
            </p>
          ) : reviewError ? (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 retro-border-sm flex items-center gap-2 text-xs font-sans text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-[var(--primary-red)]" />
              <span>{reviewError}</span>
            </div>
          ) : reviewDetails ? (
            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#58413f] dark:text-[#c8bead]">Supporter:</span>
                  <span className="font-heading font-bold text-[#1d1c11] dark:text-[#f6f1de]">
                    {reviewDetails.name}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#58413f] dark:text-[#c8bead]">Amount:</span>
                  <span className="font-heading font-bold text-[var(--primary-red)] tabular-nums">
                    ₹{reviewDetails.amount}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#58413f] dark:text-[#c8bead]">12-Digit UTR:</span>
                  <span className="font-mono font-bold text-[#1d1c11] dark:text-[#f6f1de]">
                    {reviewDetails.utr}
                  </span>
                </div>
                {reviewDetails.note && (
                  <div className="flex justify-between gap-2">
                    <span className="text-[#58413f] dark:text-[#c8bead]">Note:</span>
                    <span className="font-sans italic text-right text-[#1d1c11] dark:text-[#f6f1de]">
                      &ldquo;{reviewDetails.note}&rdquo;
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-[#58413f] dark:text-[#c8bead]">Current Status:</span>
                  <span className="font-heading font-bold uppercase text-[#1d1c11] dark:text-[#f6f1de]">
                    {reviewDetails.status}
                  </span>
                </div>
              </div>

              {reviewDetails.status === 'pending' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="font-sans text-[11px] font-semibold text-[#58413f] dark:text-[#c8bead]">
                      Thank You Note (shown in app with {reviewDetails.name} · ₹{reviewDetails.amount})
                    </label>
                    <input
                      type="text"
                      value={reviewThankYouNote}
                      onChange={(e) => setReviewThankYouNote(e.target.value)}
                      placeholder={`Thank you ${reviewDetails.name} for supporting MASTER DOCS!`}
                      className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      disabled={reviewSubmitting}
                      onClick={() => handleConfirmEmailDecision('approve')}
                      className="min-h-[44px] px-3 rounded-xl bg-[#249B65] text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>Approve (₹{reviewDetails.amount})</span>
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      type="button"
                      disabled={reviewSubmitting}
                      onClick={() => handleConfirmEmailDecision('reject')}
                      style={{ backgroundColor: 'var(--primary-red)' }}
                      className="min-h-[44px] px-3 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span>Reject</span>
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Hero Support Banner & Payment Picker */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] bg-paper-dots rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <div
            style={{ backgroundColor: 'var(--primary-red)' }}
            className="w-12 h-12 rounded-2xl retro-border flex items-center justify-center text-white shrink-0 retro-shadow-sm"
          >
            <Heart className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-heading font-bold text-lg text-[#1d1c11] dark:text-[#f6f1de] leading-snug">
              Support MASTER DOCS
            </h1>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] mt-0.5 leading-relaxed">
              100% ad-free offline document reader. Pay via UPI or QR without revealing personal numbers.
            </p>
          </div>
        </div>

        {/* Amount Picker */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs font-semibold text-[#58413f] dark:text-[#c8bead]">
            Set Support Amount (INR ₹)
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            {AMOUNT_PRESETS.map((preset) => {
              const isSelected = numericAmount === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountInput(String(preset))}
                  style={{
                    backgroundColor: isSelected ? 'var(--primary-red)' : undefined,
                  }}
                  className={`min-h-[40px] px-3.5 rounded-xl font-heading font-bold text-xs tabular-nums retro-border-sm retro-shadow-sm cursor-pointer transition-colors ${
                    isSelected
                      ? 'text-white'
                      : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de] hover:bg-[#f3eedc] dark:hover:bg-[#333128]'
                  }`}
                >
                  ₹{preset}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white dark:bg-[#212019] retro-border-sm">
            <span className="font-heading font-bold text-sm text-[var(--primary-red)]">₹</span>
            <input
              type="number"
              min={1}
              max={100000}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="Enter custom amount..."
              className="w-full bg-transparent text-sm font-heading font-bold tabular-nums text-[#1d1c11] dark:text-[#f6f1de] focus:outline-none"
            />
          </div>

          <p
            className={`font-sans text-[11px] flex items-center gap-1.5 ${
              meetsListMinimum
                ? 'text-[#249B65] font-semibold'
                : 'text-[#D88B32] dark:text-[#e5a657] font-medium'
            }`}
          >
            {meetsListMinimum ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>₹{numericAmount} qualifies for owner review &amp; Verified Contributors listing.</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Any amount helps! Minimum ₹{MIN_CONTRIBUTION_FOR_LIST_INR} is required to submit your name for the Contributors List.
                </span>
              </>
            )}
          </p>
        </div>

        {/* UPI / QR Payment Method Switcher */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPaymentTab('qr')}
            style={{
              backgroundColor: paymentTab === 'qr' ? 'var(--primary-red)' : undefined,
            }}
            className={`min-h-[42px] px-3 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentTab === 'qr'
                ? 'text-white'
                : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentTab('upi')}
            style={{
              backgroundColor: paymentTab === 'upi' ? 'var(--primary-red)' : undefined,
            }}
            className={`min-h-[42px] px-3 rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border-sm retro-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer ${
              paymentTab === 'upi'
                ? 'text-white'
                : 'bg-white dark:bg-[#212019] text-[#1d1c11] dark:text-[#f6f1de]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Pay via UPI App</span>
          </button>
        </div>

        {/* Payment Panel */}
        {paymentTab === 'qr' ? (
          <div className="p-4 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex flex-col items-center gap-2.5 text-center">
            {qrDataUrl ? (
              <div className="p-2 bg-white rounded-xl border-2 border-[#171717]">
                <img
                  src={qrDataUrl}
                  alt={`UPI QR Code for ${SUPPORT_UPI_ID}`}
                  className="w-40 h-40 object-contain block"
                />
              </div>
            ) : (
              <div className="w-40 h-40 rounded-xl bg-[#ede8d6] flex items-center justify-center">
                <QrCode className="w-10 h-10 opacity-40" />
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              <span className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] tabular-nums">
                Scan with PhonePe · GPay · Paytm · BHIM (₹{Math.max(1, numericAmount || 50)})
              </span>
              <span className="font-mono text-[11px] text-[#58413f] dark:text-[#c8bead]">
                UPI ID: {SUPPORT_UPI_ID}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full max-w-xs">
              <button
                type="button"
                onClick={handleCopyUpiId}
                className="flex-1 min-h-[38px] px-3 rounded-lg bg-[#ede8d6] dark:bg-[#3d3a30] text-[#1d1c11] dark:text-[#f6f1de] font-heading font-bold text-[11px] uppercase retro-border-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#249B65]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUpi ? 'Copied' : 'Copy UPI ID'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentInitiatedAt(Date.now())}
                style={{ backgroundColor: 'var(--primary-red)' }}
                className="flex-1 min-h-[38px] px-3 rounded-lg text-white font-heading font-bold text-[11px] uppercase retro-border-sm cursor-pointer"
              >
                I Scanned QR
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm">
              <div className="min-w-0">
                <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead] block">
                  Official App UPI ID (Privacy Protected)
                </span>
                <span className="font-mono font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de]">
                  {SUPPORT_UPI_ID}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpiId}
                className="min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#212019] retro-border-sm font-heading font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedUpi ? <Check className="w-3.5 h-3.5 text-[#249B65]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleLaunchUpiApp}
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="w-full min-h-[46px] px-4 rounded-xl text-white font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>PAY ₹{Math.max(1, numericAmount || 50)} VIA UPI APP</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Submit Payment Details -> Sends Email to maheshm81622@gmail.com for Approve / Reject */}
      <form
        onSubmit={handleSubmitForApproval}
        className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-3 min-w-0"
      >
        <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
          <h2 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
            Verify Payment &amp; Notify Owner (₹{MIN_CONTRIBUTION_FOR_LIST_INR}+ Required)
          </h2>
        </div>

        <p className="font-sans text-[11px] text-[#58413f] dark:text-[#c8bead] leading-relaxed">
          Paid <strong>₹50 or more</strong> to{' '}
          <code className="font-mono font-bold text-[#1d1c11] dark:text-[#f6f1de]">
            {SUPPORT_UPI_ID}
          </code>
          ? Submit your Name and 12-digit UTR below. A verification email with{' '}
          <strong>Approve / Reject</strong> options goes to{' '}
          <code className="font-mono">{OWNER_GMAIL_ADDRESS}</code>—once approved, your name,
          amount, and Thank You note appear in the app.
        </p>

        {submitError && (
          <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 retro-border-sm flex items-center gap-2 text-xs font-sans text-red-800 dark:text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--primary-red)]" />
            <span>{submitError}</span>
          </div>
        )}

        {pendingMailtoFallback && (
          <div className="p-3 rounded-xl bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm flex flex-col gap-2">
            <p className="font-sans text-[11px] text-[#1d1c11] dark:text-[#f6f1de]">
              Tap below to send your UTR verification email straight to{' '}
              <strong>{OWNER_GMAIL_ADDRESS}</strong> via Gmail:
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = pendingMailtoFallback;
              }}
              style={{ backgroundColor: 'var(--primary-red)' }}
              className="min-h-[40px] px-3 rounded-lg text-white font-heading font-bold text-xs uppercase tracking-wider retro-border-sm inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Send Approval Email via Gmail</span>
            </button>
          </div>
        )}

        <input
          type="text"
          value={supporterName}
          onChange={(e) => {
            setSupporterName(e.target.value);
            setSubmitError(null);
          }}
          placeholder="Your Display Name (for Contributors List)"
          className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
        />

        <input
          type="text"
          value={utrReference}
          onChange={(e) => {
            setUtrReference(e.target.value);
            setSubmitError(null);
          }}
          placeholder="12-Digit UPI UTR / Transaction Reference ID"
          className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-mono text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
        />

        <input
          type="text"
          value={supporterNote}
          onChange={(e) => setSupporterNote(e.target.value)}
          placeholder="Short appreciation note (optional)"
          className="h-11 px-3 rounded-xl bg-white dark:bg-[#212019] text-sm font-sans text-[#1d1c11] dark:text-[#f6f1de] retro-border-sm focus:outline-none"
        />

        <label className="flex items-start gap-2 cursor-pointer py-1 select-none">
          <input
            type="checkbox"
            checked={paymentConfirmedCheck}
            onChange={(e) => {
              setPaymentConfirmedCheck(e.target.checked);
              setSubmitError(null);
            }}
            className="mt-0.5 w-4 h-4 accent-[var(--primary-red)] cursor-pointer shrink-0"
          />
          <span className="font-sans text-[11px] text-[#1d1c11] dark:text-[#f6f1de] leading-relaxed">
            I confirm I completed the UPI payment of <strong>₹{Math.max(0, numericAmount)}</strong> to{' '}
            <span className="font-mono font-bold">{SUPPORT_UPI_ID}</span>
            {paymentInitiatedAt ? ' in this session.' : '.'}
          </span>
        </label>

        <motion.button
          whileTap={{ scale: 0.96 }}
          type="submit"
          disabled={submitting}
          style={{
            backgroundColor: meetsListMinimum ? 'var(--primary-red)' : undefined,
          }}
          className={`w-full min-h-[46px] rounded-xl font-heading font-bold text-xs uppercase tracking-wider retro-border retro-shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${
            meetsListMinimum
              ? 'text-white'
              : 'bg-[#ede8d6] dark:bg-[#3d3a30] text-[#58413f] dark:text-[#c8bead]'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>
            {submitting
              ? 'SENDING TO OWNER GMAIL...'
              : meetsListMinimum
              ? `SUBMIT ₹${numericAmount} FOR OWNER APPROVAL`
              : `MINIMUM ₹${MIN_CONTRIBUTION_FOR_LIST_INR} REQUIRED FOR LIST`}
          </span>
        </motion.button>
      </form>

      {/* Pending Verification Submissions Status */}
      {activePendingItems.length > 0 && (
        <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 retro-border retro-shadow flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-[#D88B32]">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Awaiting Owner Gmail Approval ({activePendingItems.length})</span>
          </div>
          {activePendingItems.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-xl bg-white dark:bg-[#212019] retro-border-sm flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-heading font-bold text-[#1d1c11] dark:text-[#f6f1de] block truncate">
                  {item.name} · ₹{item.amount}
                </span>
                <span className="font-sans text-[10px] text-[#58413f] dark:text-[#c8bead]">
                  UTR {item.utrMasked} · Checking with {OWNER_GMAIL_ADDRESS}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#ede8d6] dark:bg-[#3d3a30] retro-border-sm font-heading font-bold text-[10px] uppercase text-[#D88B32] shrink-0">
                Pending
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Approved Contributors Wall */}
      <div className="bg-[#f9f4e1] dark:bg-[#2b2921] rounded-2xl p-4 sm:p-5 retro-border retro-shadow flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--primary-red)] shrink-0" />
            <h2 className="font-heading font-bold text-xs text-[#1d1c11] dark:text-[#f6f1de] uppercase tracking-wider">
              Verified Contributors (₹50+)
            </h2>
          </div>
          <span className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] tabular-nums">
            {contributors.length} approved
          </span>
        </div>

        {contributors.length === 0 ? (
          <div className="py-6 text-center flex flex-col items-center gap-1.5">
            <Heart className="w-8 h-8 text-[#58413f]/50 dark:text-[#c8bead]/50" />
            <p className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de]">
              No Approved Contributors Yet
            </p>
            <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] max-w-xs leading-relaxed">
              Contributors who donate ₹50+ appear here with their contribution amount and a Thank You note once approved by the owner.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/10 dark:divide-white/10">
            {contributors.map((c) => (
              <div key={c.id} className="py-3 first:pt-1 last:pb-1 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-heading font-bold text-sm text-[#1d1c11] dark:text-[#f6f1de] truncate">
                      {c.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#249B65] text-white font-heading font-bold text-[9px] uppercase shrink-0">
                      VERIFIED
                    </span>
                  </div>
                  <span className="font-heading font-bold text-xs text-[var(--primary-red)] tabular-nums shrink-0">
                    Contributed ₹{c.amount}
                  </span>
                </div>

                {c.thankYouNote && (
                  <div className="p-2 rounded-lg bg-white dark:bg-[#212019] retro-border-sm flex items-start gap-1.5">
                    <MessageSquareHeart className="w-3.5 h-3.5 text-[#249B65] shrink-0 mt-0.5" />
                    <p className="font-sans text-[11px] text-[#1d1c11] dark:text-[#f6f1de]">
                      <strong className="font-heading">Owner Note:</strong> {c.thankYouNote}
                    </p>
                  </div>
                )}

                {c.note && (
                  <p className="font-sans text-xs text-[#58413f] dark:text-[#c8bead] italic">
                    &ldquo;{c.note}&rdquo;
                  </p>
                )}
                <span className="font-mono text-[10px] text-[#58413f]/80 dark:text-[#c8bead]/80 tabular-nums">
                  UTR {c.utrMasked} • {formatDateLabel(c.verifiedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
