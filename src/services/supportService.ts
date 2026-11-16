import { ContributorEntry } from '../types/document';
import { isNativeAndroid } from './nativeStorageService';

export const SUPPORT_UPI_ID = 'masterdocs@ibl';
export const SUPPORT_PAYEE_NAME = 'MASTER DOCS';
export const OWNER_GMAIL_ADDRESS = 'maheshm81622@gmail.com';
export const MIN_CONTRIBUTION_FOR_LIST_INR = 50;

const PENDING_CONTRIB_STORAGE_KEY = 'masterdocs_pending_contributions_v1';
const DEFAULT_HOSTED_BACKEND =
  'https://ais-pre-gih2omoypgpxkaebnzt3fs-166224213200.asia-southeast1.run.app';

export interface PendingLocalSubmission {
  id: string;
  name: string;
  amount: number;
  utrMasked: string;
  utrHash: string;
  status: 'pending' | 'approved' | 'rejected';
  thankYouNote?: string;
  submittedAt: string;
}

export interface ReviewRequestDetails {
  id: string;
  name: string;
  amount: number;
  utr: string;
  utrMasked: string;
  utrHash: string;
  note?: string;
  thankYouNote?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export function resolveApiBaseUrl(): string {
  const envUrl = (import.meta as any)?.env?.VITE_BACKEND_URL;
  if (isNativeAndroid()) {
    return (typeof envUrl === 'string' && envUrl.trim()) || DEFAULT_HOSTED_BACKEND;
  }
  return '';
}

export function buildUpiPaymentUri(amount: number, supporterName?: string): string {
  const cleanAmount = Math.max(1, Math.round((Number(amount) || 50) * 100) / 100);
  const note = supporterName?.trim()
    ? `Support Master Docs - ${supporterName.trim().slice(0, 24)}`
    : 'Support Master Docs Development';

  const params = new URLSearchParams({
    pa: SUPPORT_UPI_ID,
    pn: SUPPORT_PAYEE_NAME,
    tn: note,
    am: cleanAmount.toFixed(2),
    cu: 'INR',
  });
  return `upi://pay?${params.toString()}`;
}

export function validateUtrReference(rawUtr: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = rawUtr.replace(/[\s-]+/g, '').toUpperCase();
  if (!normalized) {
    return {
      valid: false,
      normalized,
      error: 'Enter the 12-digit UPI Transaction / UTR Reference ID from your payment receipt.',
    };
  }

  const isTwelveDigit = /^\d{12}$/.test(normalized);
  const digitCount = (normalized.match(/\d/g) || []).length;
  const isNpciAlnum = /^[A-Z0-9]{12,24}$/.test(normalized) && digitCount >= 8;

  if (!isTwelveDigit && !isNpciAlnum) {
    return {
      valid: false,
      normalized,
      error: 'Invalid UTR format. Enter a valid 12-digit UPI Reference / UTR ID.',
    };
  }

  if (/^(.)\1+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Please enter the real UTR number from your UPI receipt.',
    };
  }

  const trivialSequences = new Set([
    '012345678901',
    '123456789012',
    '123456789123',
    '987654321098',
  ]);
  if (trivialSequences.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Please enter the genuine UPI Reference ID from your payment app.',
    };
  }

  return { valid: true, normalized };
}

export function maskUtr(normalized: string): string {
  if (normalized.length <= 4) return normalized;
  return `••••${normalized.slice(-4)}`;
}

export async function hashUtr(normalized: string): Promise<string> {
  const payload = `masterdocs_utr:${normalized}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h1 = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h1 ^= payload.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0');
}

export function getLocalPendingSubmissions(): PendingLocalSubmission[] {
  try {
    const raw = localStorage.getItem(PENDING_CONTRIB_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalPendingSubmissions(list: PendingLocalSubmission[]): void {
  try {
    localStorage.setItem(PENDING_CONTRIB_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export async function submitContributionForApproval(input: {
  id?: string;
  name: string;
  amount: number;
  utr: string;
  note?: string;
}): Promise<{
  id: string;
  utr: string;
  utrMasked: string;
  utrHash: string;
  emailSent: boolean;
  mailtoUrl: string;
  submission: PendingLocalSubmission;
}> {
  const cleanName = input.name.trim();
  if (cleanName.length < 2) {
    throw new Error('Please enter your name (at least 2 characters).');
  }

  const numericAmount = Math.floor(Number(input.amount) || 0);
  if (numericAmount < MIN_CONTRIBUTION_FOR_LIST_INR) {
    throw new Error(
      `A minimum payment of ₹${MIN_CONTRIBUTION_FOR_LIST_INR} is required to appear on the Contributors List.`
    );
  }

  const utrCheck = validateUtrReference(input.utr);
  if (!utrCheck.valid) {
    throw new Error(utrCheck.error || 'Invalid UPI Reference ID.');
  }

  const requestId =
    input.id || `contrib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const res = await fetch(`${resolveApiBaseUrl()}/api/contributions/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: requestId,
      name: cleanName.slice(0, 40),
      amount: numericAmount,
      utr: utrCheck.normalized,
      note: input.note?.trim() ? input.note.trim().slice(0, 120) : undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not submit payment verification request.');
  }

  const submission: PendingLocalSubmission = {
    id: data.id || requestId,
    name: cleanName.slice(0, 40),
    amount: numericAmount,
    utrMasked: data.utrMasked || maskUtr(utrCheck.normalized),
    utrHash: data.utrHash || (await hashUtr(utrCheck.normalized)),
    status: 'pending',
    submittedAt: new Date().toISOString(),
  };

  const current = getLocalPendingSubmissions().filter((item) => item.id !== submission.id);
  saveLocalPendingSubmissions([submission, ...current].slice(0, 10));

  return {
    id: submission.id,
    utr: utrCheck.normalized,
    utrMasked: submission.utrMasked,
    utrHash: submission.utrHash,
    emailSent: Boolean(data.emailSent),
    mailtoUrl: String(data.mailtoUrl || ''),
    submission,
  };
}

export async function fetchApprovedContributorsFromServer(): Promise<{
  contributors: ContributorEntry[];
  emailConfigured: boolean;
}> {
  const res = await fetch(`${resolveApiBaseUrl()}/api/contributions`);
  if (!res.ok) {
    throw new Error('Unable to load contributors.');
  }
  const data = await res.json();
  return {
    contributors: Array.isArray(data?.contributors) ? data.contributors : [],
    emailConfigured: Boolean(data?.emailConfigured),
  };
}

export async function fetchContributionStatuses(
  ids: string[]
): Promise<Record<string, { status: 'pending' | 'approved' | 'rejected'; thankYouNote?: string }>> {
  if (ids.length === 0) return {};
  const res = await fetch(`${resolveApiBaseUrl()}/api/contributions/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data?.statuses || {};
}

export async function fetchReviewRequestInfo(
  id: string,
  token: string
): Promise<ReviewRequestDetails> {
  const res = await fetch(
    `${resolveApiBaseUrl()}/api/contributions/review-info?id=${encodeURIComponent(
      id
    )}&token=${encodeURIComponent(token)}`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Could not load contribution details for review.');
  }
  return data as ReviewRequestDetails;
}

export async function submitOwnerDecision(input: {
  id: string;
  token: string;
  action: 'approve' | 'reject';
  thankYouNote?: string;
}): Promise<{ status: 'approved' | 'rejected'; entry?: ContributorEntry }> {
  const res = await fetch(`${resolveApiBaseUrl()}/api/contributions/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || 'Failed updating contribution status.');
  }
  return data;
}
