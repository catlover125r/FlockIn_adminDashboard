import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB, getAdminAuth } from '@/lib/firebaseAdmin';
import { adminDocId, isOwnerEmail } from '@/lib/owner';

/**
 * Result of an admin check: either the verified caller, or the response to
 * return.
 */
type AdminCheck =
  | { ok: true; uid: string; email: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies that the caller is a signed-in admin.
 *
 * These routes run with Admin SDK credentials, which bypass Firestore rules
 * entirely — so the rules are no defence here and the check has to happen in
 * the route itself. Callers send the Firebase ID token as a bearer token; we
 * verify the signature and then confirm the uid is present in /admins.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminCheck> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // See requireUser: a broken service-account env var surfaces here, and
  // reporting it as 401 blames the caller for the deployment's problem.
  let adminAuth: ReturnType<typeof getAdminAuth>;
  try {
    adminAuth = getAdminAuth();
  } catch (error) {
    console.error('[requireAdmin] Admin SDK unavailable:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'server_misconfigured' }, { status: 500 }),
    };
  }

  let uid: string;
  let email: string;
  try {
    // checkRevoked: a signed-out or disabled admin must stop working immediately,
    // not when their hour-long token happens to expire.
    const decoded = await adminAuth.verifyIdToken(token, true);
    if (!decoded.email) {
      // Admin identity is keyed by email, so a token without one can never
      // match a row no matter what uid it carries.
      return {
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
    uid = decoded.uid;
    email = decoded.email.toLowerCase();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // The owner is an admin unconditionally, so an empty or mangled /admins
  // collection cannot lock the last person capable of repairing it out.
  if (isOwnerEmail(email)) return { ok: true, uid, email };

  const adminDoc = await getAdminDB().collection('admins').doc(adminDocId(email)).get();
  if (!adminDoc.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, uid, email };
}

/**
 * Verifies the caller is the owner — the single account permitted to change who
 * is an admin. Everything else an admin can do is available to all admins; this
 * gate exists only for /admins writes.
 */
export async function requireOwner(req: NextRequest): Promise<AdminCheck> {
  const check = await requireAdmin(req);
  if (!check.ok) return check;

  if (!isOwnerEmail(check.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Only the owner can change the admin list.' },
        { status: 403 }
      ),
    };
  }

  return check;
}
