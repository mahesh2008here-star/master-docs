import { VaultLockType, VaultSecurityConfig } from '../types/document';
import { getVaultSecurityConfig, saveVaultSecurityConfig } from '../storage/db';

export const PRESET_SECURITY_QUESTIONS = [
  'What was the name of your first school?',
  'What is your favorite childhood book?',
  'In what city were you born?',
  'What was the name of your first pet?',
  'What is your mother’s maiden name?',
] as const;

const MAX_ATTEMPTS_BEFORE_COOLDOWN = 5;
const COOLDOWN_MS = 30_000;

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashWithSalt(salt: string, value: string): Promise<string> {
  const payload = `${salt}:${value}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback non-subtle salted iterative hash for restricted non-HTTPS contexts
  let h1 = 0xdeadbeef ^ salt.length;
  let h2 = 0x41c6ce57 ^ value.length;
  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export function validateLockSecret(
  lockType: VaultLockType,
  secret: string
): { valid: boolean; error?: string } {
  if (lockType === 'pin') {
    if (!/^\d+$/.test(secret)) {
      return { valid: false, error: 'PIN must contain digits (0–9) only.' };
    }
    if (secret.length < 4 || secret.length > 8) {
      return { valid: false, error: 'PIN must be 4 to 8 digits long.' };
    }
    return { valid: true };
  }

  if (secret.trim().length < 4) {
    return { valid: false, error: 'Password must be at least 4 characters.' };
  }
  return { valid: true };
}

export async function setupVaultLock(
  lockType: VaultLockType,
  secret: string,
  securityQuestion: string,
  securityAnswer: string
): Promise<VaultSecurityConfig> {
  const cleanQuestion = securityQuestion.trim();
  const normalizedAnswer = securityAnswer.trim().toLowerCase();

  if (!cleanQuestion) {
    throw new Error('Please choose or enter a security question.');
  }
  if (normalizedAnswer.length < 2) {
    throw new Error('Security answer must be at least 2 characters.');
  }

  const validation = validateLockSecret(lockType, secret);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const salt = generateSalt();
  const [secretHash, answerHash] = await Promise.all([
    hashWithSalt(salt, secret),
    hashWithSalt(salt, normalizedAnswer),
  ]);

  const config: VaultSecurityConfig = {
    lockType,
    salt,
    secretHash,
    securityQuestion: cleanQuestion,
    answerHash,
    failedAttempts: 0,
    lockoutUntil: null,
    updatedAt: new Date().toISOString(),
  };

  await saveVaultSecurityConfig(config);
  return config;
}

export async function verifyVaultSecret(secret: string): Promise<{
  success: boolean;
  config: VaultSecurityConfig | null;
  remainingAttempts: number;
  lockoutSeconds: number;
}> {
  const config = await getVaultSecurityConfig();
  if (!config) {
    return { success: false, config: null, remainingAttempts: 0, lockoutSeconds: 0 };
  }

  const now = Date.now();
  if (config.lockoutUntil && now < config.lockoutUntil) {
    return {
      success: false,
      config,
      remainingAttempts: 0,
      lockoutSeconds: Math.ceil((config.lockoutUntil - now) / 1000),
    };
  }

  const attemptHash = await hashWithSalt(config.salt, secret);
  if (attemptHash === config.secretHash) {
    const updated: VaultSecurityConfig = {
      ...config,
      failedAttempts: 0,
      lockoutUntil: null,
    };
    await saveVaultSecurityConfig(updated);
    return {
      success: true,
      config: updated,
      remainingAttempts: MAX_ATTEMPTS_BEFORE_COOLDOWN,
      lockoutSeconds: 0,
    };
  }

  const nextFailures = (config.failedAttempts || 0) + 1;
  const triggerLockout = nextFailures >= MAX_ATTEMPTS_BEFORE_COOLDOWN;
  const lockoutUntil = triggerLockout ? now + COOLDOWN_MS : null;

  const updated: VaultSecurityConfig = {
    ...config,
    failedAttempts: triggerLockout ? 0 : nextFailures,
    lockoutUntil,
  };
  await saveVaultSecurityConfig(updated);

  return {
    success: false,
    config: updated,
    remainingAttempts: triggerLockout ? 0 : MAX_ATTEMPTS_BEFORE_COOLDOWN - nextFailures,
    lockoutSeconds: triggerLockout ? Math.ceil(COOLDOWN_MS / 1000) : 0,
  };
}

export async function verifySecurityAnswer(answer: string): Promise<boolean> {
  const config = await getVaultSecurityConfig();
  if (!config) return false;
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return false;
  const attemptHash = await hashWithSalt(config.salt, normalized);
  return attemptHash === config.answerHash;
}
