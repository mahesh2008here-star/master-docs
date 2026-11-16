import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import type { Request, Response } from 'express';
import nodemailer from 'nodemailer';

const PORT = Number(process.env.PORT) || 3000;
const OWNER_GMAIL = 'maheshm81622@gmail.com';
const SUPPORT_UPI_ID = 'masterdocs@ibl';
const MIN_CONTRIBUTION_INR = 50;

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'contributions.json');
const SECRET_FILE = path.join(DATA_DIR, '.approval-secret');

interface StoredContribution {
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
  verifiedAt?: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getApprovalSecret(): string {
  if (process.env.APPROVAL_SECRET && process.env.APPROVAL_SECRET.trim().length >= 16) {
    return process.env.APPROVAL_SECRET.trim();
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (existing.length >= 16) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

function readContributions(): StoredContribution[] {
  ensureDataDir();
  if (!fs.existsSync(CONTRIBUTIONS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(CONTRIBUTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeContributions(items: StoredContribution[]) {
  ensureDataDir();
  fs.writeFileSync(CONTRIBUTIONS_FILE, JSON.stringify(items, null, 2), 'utf8');
}

function signReviewToken(id: string): string {
  return crypto
    .createHmac('sha256', getApprovalSecret())
    .update(`masterdocs_review:${id}`)
    .digest('hex');
}

function verifyReviewToken(id: string, token: string): boolean {
  if (!id || !token || typeof token !== 'string') return false;
  const expected = signReviewToken(id);
  const bufA = Buffer.from(expected, 'utf8');
  const bufB = Buffer.from(token.trim(), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeAndValidateUtr(rawUtr: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = String(rawUtr || '')
    .replace(/[\s-]+/g, '')
    .toUpperCase();
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
    return { valid: false, normalized, error: 'Please enter the real UTR from your receipt.' };
  }
  const trivial = new Set(['012345678901', '123456789012', '123456789123', '987654321098']);
  if (trivial.has(normalized)) {
    return { valid: false, normalized, error: 'Please enter the genuine UPI Reference ID.' };
  }
  return { valid: true, normalized };
}

function hashUtrServer(normalized: string): string {
  return crypto.createHash('sha256').update(`masterdocs_utr:${normalized}`).digest('hex');
}

function maskUtrServer(normalized: string): string {
  return normalized.length <= 4 ? normalized : `••••${normalized.slice(-4)}`;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveAppOrigin(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.startsWith('http')) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const protoHeader = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${protoHeader.split(',')[0].trim()}://${host}`;
}

async function sendOwnerNotificationEmail(params: {
  entry: StoredContribution;
  approveUrl: string;
  rejectUrl: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!gmailUser || !gmailPass) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  const { entry, approveUrl, rejectUrl } = params;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #fff9e7; border: 2px solid #171717; border-radius: 16px; padding: 24px; color: #1d1c11;">
      <h2 style="margin: 0 0 8px 0; color: #a92f2e;">New MASTER DOCS Support Payment</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #58413f;">
        Verify that <strong>₹${entry.amount}</strong> arrived on <strong>${SUPPORT_UPI_ID}</strong> with the UTR below, then choose <strong>Approve</strong> or <strong>Reject</strong>.
      </p>
      <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #171717; border-radius: 10px; margin-bottom: 18px;">
        <tr><td style="padding: 10px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Supporter Name</td><td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${escapeHtml(entry.name)}</td></tr>
        <tr><td style="padding: 10px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Amount</td><td style="padding: 10px 12px; border-bottom: 1px solid #eee; color: #a92f2e; font-weight: bold;">₹${entry.amount}</td></tr>
        <tr><td style="padding: 10px 12px; font-weight: bold; border-bottom: 1px solid #eee;">UPI Reference / UTR</td><td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-family: monospace; font-weight: bold;">${escapeHtml(entry.utr)}</td></tr>
        ${entry.note ? `<tr><td style="padding: 10px 12px; font-weight: bold; border-bottom: 1px solid #eee;">Supporter Note</td><td style="padding: 10px 12px; border-bottom: 1px solid #eee;">"${escapeHtml(entry.note)}"</td></tr>` : ''}
        <tr><td style="padding: 10px 12px; font-weight: bold;">Submitted At</td><td style="padding: 10px 12px;">${escapeHtml(entry.submittedAt)}</td></tr>
      </table>
      <div style="display: flex; gap: 12px; margin-top: 16px;">
        <a href="${approveUrl}" style="display: inline-block; background: #249b65; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 20px; border-radius: 10px; border: 2px solid #171717; margin-right: 10px;">
          Approve & Add Thank You Note
        </a>
        <a href="${rejectUrl}" style="display: inline-block; background: #a92f2e; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 20px; border-radius: 10px; border: 2px solid #171717;">
          Reject (Do Not Add)
        </a>
      </div>
      <p style="margin-top: 18px; font-size: 12px; color: #58413f;">
        Approving adds ${escapeHtml(entry.name)} to the Verified Contributors list in MASTER DOCS with your Thank You note. Rejecting leaves the app unchanged.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"MASTER DOCS Support" <${gmailUser}>`,
    to: OWNER_GMAIL,
    subject: `[MASTER DOCS] Payment Verification: ₹${entry.amount} by ${entry.name} (UTR ${entry.utr})`,
    text: [
      `New MASTER DOCS Support Payment Verification`,
      `Name: ${entry.name}`,
      `Amount: ₹${entry.amount}`,
      `UPI UTR: ${entry.utr}`,
      entry.note ? `Note: ${entry.note}` : '',
      `Submitted: ${entry.submittedAt}`,
      ``,
      `APPROVE (add to app with Thank You note): ${approveUrl}`,
      `REJECT (leave unchanged): ${rejectUrl}`,
    ]
      .filter(Boolean)
      .join('\n'),
    html: htmlBody,
  });

  return { sent: true };
}

function buildMailtoUrl(params: {
  entry: StoredContribution;
  approveUrl: string;
  rejectUrl: string;
}): string {
  const { entry, approveUrl, rejectUrl } = params;
  const subject = `[MASTER DOCS] Verify ₹${entry.amount} Support by ${entry.name}`;
  const body = [
    `Hello MASTER DOCS Owner,`,
    ``,
    `I completed a UPI support payment to ${SUPPORT_UPI_ID}. Please check the transaction and approve or reject:`,
    ``,
    `Supporter Name: ${entry.name}`,
    `Amount Paid: ₹${entry.amount}`,
    `12-Digit UPI UTR: ${entry.utr}`,
    entry.note ? `Message: ${entry.note}` : '',
    `Submission ID: ${entry.id}`,
    ``,
    `--- OWNER ACTIONS ---`,
    `APPROVE & ADD THANK YOU NOTE:`,
    approveUrl,
    ``,
    `REJECT (LEAVE APP UNCHANGED):`,
    rejectUrl,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return `mailto:${OWNER_GMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Allow Capacitor Android WebView & browser requests to reach verification API
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Public list of ONLY approved contributors
  app.get('/api/contributions', (_req: Request, res: Response) => {
    const all = readContributions();
    const approved = all
      .filter((c) => c.status === 'approved')
      .sort((a, b) => new Date(b.verifiedAt || b.submittedAt).getTime() - new Date(a.verifiedAt || a.submittedAt).getTime())
      .map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        note: c.note,
        thankYouNote: c.thankYouNote,
        utrMasked: c.utrMasked,
        utrHash: c.utrHash,
        verifiedAt: c.verifiedAt || c.submittedAt,
      }));

    res.json({
      contributors: approved,
      emailConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      ownerEmail: OWNER_GMAIL,
    });
  });

  // Submit contribution claim -> saves PENDING + sends Gmail approval message to maheshm81622@gmail.com
  app.post('/api/contributions/submit', async (req: Request, res: Response) => {
    try {
      const { id: requestedId, name, amount, utr, note } = req.body || {};
      const cleanName = String(name || '').trim();
      if (cleanName.length < 2) {
        res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
        return;
      }

      const numericAmount = Math.floor(Number(amount) || 0);
      if (numericAmount < MIN_CONTRIBUTION_INR) {
        res.status(400).json({
          error: `A minimum payment of ₹${MIN_CONTRIBUTION_INR} is required to appear on the Contributors List.`,
        });
        return;
      }

      const utrCheck = normalizeAndValidateUtr(utr);
      if (!utrCheck.valid) {
        res.status(400).json({ error: utrCheck.error || 'Invalid UPI Reference ID.' });
        return;
      }

      const utrHash = hashUtrServer(utrCheck.normalized);
      const list = readContributions();
      const existingSameUtr = list.find(
        (item) => item.utrHash === utrHash && item.status !== 'rejected'
      );
      if (existingSameUtr) {
        res.status(409).json({
          error:
            existingSameUtr.status === 'approved'
              ? 'This UPI UTR Reference ID has already been verified.'
              : 'This UPI UTR Reference ID is already pending verification.',
        });
        return;
      }

      const id =
        typeof requestedId === 'string' && /^[a-zA-Z0-9_-]{6,80}$/.test(requestedId)
          ? requestedId
          : `contrib-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

      const entry: StoredContribution = {
        id,
        name: cleanName.slice(0, 40),
        amount: numericAmount,
        utr: utrCheck.normalized,
        utrMasked: maskUtrServer(utrCheck.normalized),
        utrHash,
        note: note ? String(note).trim().slice(0, 120) : undefined,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      list.push(entry);
      writeContributions(list);

      const token = signReviewToken(entry.id);
      const origin = resolveAppOrigin(req);
      const approveUrl = `${origin}/?reviewContribution=${encodeURIComponent(entry.id)}&action=approve&token=${encodeURIComponent(token)}`;
      const rejectUrl = `${origin}/?reviewContribution=${encodeURIComponent(entry.id)}&action=reject&token=${encodeURIComponent(token)}`;

      let emailSent = false;
      let emailFallbackReason: string | undefined;
      try {
        const mailRes = await sendOwnerNotificationEmail({ entry, approveUrl, rejectUrl });
        emailSent = mailRes.sent;
        emailFallbackReason = mailRes.reason;
      } catch (err: any) {
        console.warn('Gmail SMTP send failed, falling back to mailto compose:', err?.message);
        emailSent = false;
        emailFallbackReason = err?.message || 'SMTP_ERROR';
      }

      const mailtoUrl = buildMailtoUrl({ entry, approveUrl, rejectUrl });

      res.status(201).json({
        id: entry.id,
        status: entry.status,
        utrMasked: entry.utrMasked,
        utrHash: entry.utrHash,
        emailSent,
        emailFallbackReason,
        mailtoUrl,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed submitting contribution claim.' });
    }
  });

  // Check status of contributor's own pending IDs
  app.post('/api/contributions/status', (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const list = readContributions();
    const statuses: Record<string, { status: string; thankYouNote?: string; name: string; amount: number }> = {};
    for (const id of ids) {
      const found = list.find((c) => c.id === id);
      if (found) {
        statuses[id] = {
          status: found.status,
          thankYouNote: found.thankYouNote,
          name: found.name,
          amount: found.amount,
        };
      }
    }
    res.json({ statuses });
  });

  // Fetch signed submission details for owner reviewing from Gmail link
  app.get('/api/contributions/review-info', (req: Request, res: Response) => {
    const id = String(req.query.id || '');
    const token = String(req.query.token || '');
    if (!verifyReviewToken(id, token)) {
      res.status(403).json({ error: 'Invalid or expired approval link signature.' });
      return;
    }

    const found = readContributions().find((c) => c.id === id);
    if (!found) {
      res.status(404).json({ error: 'Contribution request not found.' });
      return;
    }

    res.json({
      id: found.id,
      name: found.name,
      amount: found.amount,
      utr: found.utr,
      utrMasked: found.utrMasked,
      utrHash: found.utrHash,
      note: found.note,
      thankYouNote: found.thankYouNote,
      status: found.status,
      submittedAt: found.submittedAt,
    });
  });

  // Owner Approve / Reject decision endpoint (verified by signed HMAC token)
  app.post('/api/contributions/decision', (req: Request, res: Response) => {
    const { id, token, action, thankYouNote } = req.body || {};
    if (!verifyReviewToken(String(id || ''), String(token || ''))) {
      res.status(403).json({ error: 'Invalid or unauthorized approval signature.' });
      return;
    }
    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Action must be "approve" or "reject".' });
      return;
    }

    const list = readContributions();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Contribution request not found.' });
      return;
    }

    if (list[idx].status !== 'pending') {
      res.json({
        status: list[idx].status,
        entry: list[idx].status === 'approved' ? list[idx] : undefined,
        alreadyReviewed: true,
      });
      return;
    }

    if (action === 'approve') {
      const cleanThankYou =
        String(thankYouNote || '').trim().slice(0, 200) ||
        `Thank you so much, ${list[idx].name}, for supporting MASTER DOCS!`;
      list[idx].status = 'approved';
      list[idx].thankYouNote = cleanThankYou;
      list[idx].verifiedAt = new Date().toISOString();
      writeContributions(list);

      res.json({
        status: 'approved',
        entry: {
          id: list[idx].id,
          name: list[idx].name,
          amount: list[idx].amount,
          note: list[idx].note,
          thankYouNote: list[idx].thankYouNote,
          utrMasked: list[idx].utrMasked,
          utrHash: list[idx].utrHash,
          verifiedAt: list[idx].verifiedAt,
        },
      });
      return;
    }

    // Rejected -> leave approved contributors list completely untouched
    list[idx].status = 'rejected';
    list[idx].verifiedAt = new Date().toISOString();
    writeContributions(list);
    res.json({ status: 'rejected' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MASTER DOCS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed starting MASTER DOCS server:', err);
  process.exit(1);
});
