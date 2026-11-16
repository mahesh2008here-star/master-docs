# Firestore Security Specification — MASTER DOCS Support & Contributors

## 1. Data Invariants
1. Public reads on `/contributors/{contributorId}` are strictly restricted to documents with `status == 'approved'` and contain zero PII (only display name, INR amount, optional note, masked UTR, thank-you note, and timestamps).
2. Only verified admins (`maheshm81622@gmail.com` or `mahesh.2008here@gmail.com` with `email_verified == true`, or listed in `/admins/{uid}`) may create/update/delete `/contributors/{contributorId}`.
3. New `/contribution_requests/{requestId}` records must start with `status == 'pending'`, `amount >= 50`, valid UTR length/format, `ownerId == request.auth.uid`, and server timestamps (`request.time`).
4. Only verified admins may transition a `pending` request to `approved` or `rejected`; terminal states (`approved`, `rejected`) cannot be re-opened or overwritten.
5. Non-admin users can only `get`/`list` their own `/contribution_requests` (`resource.data.ownerId == request.auth.uid`), preventing scraping of other users' raw UTRs.

## 2. Dirty Dozen Attack Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated create on `/contributors/hack1` -> Denied (`isAdmin()` false).
2. Signed-in non-admin user trying to write directly to `/contributors/self1` -> Denied (`isAdmin()` false).
3. Unverified email spoof (`email: "maheshm81622@gmail.com"`, `email_verified: false`) -> Denied (`email_verified == true` check).
4. Shadow field injection on `/contributors` (`extraField: true`) -> Denied (`keys().hasOnly(...)`).
5. Under-minimum contribution (`amount: 10`) on `/contribution_requests` -> Denied (`amount >= 50`).
6. Creating a `/contribution_requests` doc with `status: "approved"` directly -> Denied (`status == 'pending'` required on create).
7. Creating a `/contribution_requests` doc spoofing another user's `ownerId` -> Denied (`ownerId == request.auth.uid`).
8. Re-opening an already `approved` request back to `pending` -> Denied (`existing().status == 'pending'` required on update).
9. Blanket `list` query on `/contribution_requests` by a normal signed-in user without `ownerId == request.auth.uid` filter -> Denied.
10. Oversized ID injection (`1.5KB` doc ID) -> Denied (`isValidId()` <= 128 chars regex).
11. Client-forged timestamp (`createdAt` != `request.time`) -> Denied (temporal integrity check).
12. Normal user attempting to modify `/admins/{uid}` -> Denied (`allow create, update, delete: if false`).
