import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ContributorEntry } from '../types/document';

export const OWNER_REVIEW_EMAIL = 'maheshm81622@gmail.com';
const ADMIN_EMAILS = new Set(['maheshm81622@gmail.com', 'mahesh.2008here@gmail.com']);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on startup as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function isAuthorizedAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return ADMIN_EMAILS.has(user.email.toLowerCase());
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

function timestampToIso(ts: Timestamp | string | undefined): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  if (typeof (ts as any).toDate === 'function') {
    return (ts as any).toDate().toISOString();
  }
  return new Date().toISOString();
}

export interface FirestorePendingRequest {
  id: string;
  ownerId: string;
  name: string;
  amount: number;
  utr: string;
  utrMasked: string;
  utrHash: string;
  note?: string;
  thankYouNote?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export function subscribeApprovedContributors(
  onData: (items: ContributorEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'contributors';
  const q = query(collection(db, path), where('status', '==', 'approved'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ContributorEntry[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          name: String(data.name || ''),
          amount: Number(data.amount) || 50,
          note: data.note ? String(data.note) : undefined,
          thankYouNote: data.thankYouNote ? String(data.thankYouNote) : undefined,
          utrMasked: String(data.utrMasked || ''),
          utrHash: String(data.utrHash || ''),
          verifiedAt: timestampToIso(data.createdAt),
        };
      });
      items.sort(
        (a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime()
      );
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function createFirestorePendingRequest(input: {
  id: string;
  name: string;
  amount: number;
  utr: string;
  utrMasked: string;
  utrHash: string;
  note?: string;
}): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const path = `contribution_requests/${input.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: input.id,
      ownerId: user.uid,
      name: input.name.slice(0, 40),
      amount: Math.floor(input.amount),
      utr: input.utr,
      utrMasked: input.utrMasked,
      utrHash: input.utrHash,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.note && input.note.trim()) {
      payload.note = input.note.trim().slice(0, 120);
    }
    await setDoc(doc(db, 'contribution_requests', input.id), payload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribePendingRequestsForAdmin(
  onData: (items: FirestorePendingRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  const user = auth.currentUser;
  if (!isAuthorizedAdminUser(user)) {
    onData([]);
    return () => {};
  }

  const path = 'contribution_requests';
  const q = query(collection(db, path), where('status', '==', 'pending'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestorePendingRequest[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: data.id || d.id,
          ownerId: String(data.ownerId || ''),
          name: String(data.name || ''),
          amount: Number(data.amount) || 50,
          utr: String(data.utr || ''),
          utrMasked: String(data.utrMasked || ''),
          utrHash: String(data.utrHash || ''),
          note: data.note ? String(data.note) : undefined,
          thankYouNote: data.thankYouNote ? String(data.thankYouNote) : undefined,
          status: (data.status || 'pending') as FirestorePendingRequest['status'],
          createdAt: timestampToIso(data.createdAt),
        };
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function approveContributionInFirestore(input: {
  id: string;
  name: string;
  amount: number;
  note?: string;
  utrMasked: string;
  utrHash: string;
  thankYouNote: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!isAuthorizedAdminUser(user) || !user) {
    throw new Error(`Sign in with ${OWNER_REVIEW_EMAIL} to approve contributors.`);
  }

  const cleanThankYou =
    input.thankYouNote.trim().slice(0, 200) ||
    `Thank you so much, ${input.name.trim()}, for supporting MASTER DOCS!`;

  const contribPath = `contributors/${input.id}`;
  try {
    const payload: Record<string, unknown> = {
      id: input.id,
      name: input.name.trim().slice(0, 40),
      amount: Math.floor(input.amount),
      thankYouNote: cleanThankYou,
      utrMasked: input.utrMasked,
      utrHash: input.utrHash,
      status: 'approved',
      approvedByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.note && input.note.trim()) {
      payload.note = input.note.trim().slice(0, 120);
    }
    await setDoc(doc(db, 'contributors', input.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, contribPath);
  }

  // Also update matching pending request status if it exists in Firestore
  const reqPath = `contribution_requests/${input.id}`;
  try {
    const reqRef = doc(db, 'contribution_requests', input.id);
    const snap = await getDoc(reqRef);
    if (snap.exists() && snap.data()?.status === 'pending') {
      await updateDoc(reqRef, {
        status: 'approved',
        thankYouNote: cleanThankYou,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }
}

export async function rejectContributionInFirestore(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!isAuthorizedAdminUser(user)) {
    throw new Error(`Sign in with ${OWNER_REVIEW_EMAIL} to reject requests.`);
  }

  const reqPath = `contribution_requests/${id}`;
  try {
    const reqRef = doc(db, 'contribution_requests', id);
    const snap = await getDoc(reqRef);
    if (snap.exists() && snap.data()?.status === 'pending') {
      await updateDoc(reqRef, {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reqPath);
  }
}
