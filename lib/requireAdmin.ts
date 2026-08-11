import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB, getAdminAuth } from '@/lib/firebaseAdmin';
import { adminDocId, isOwnerEmail } from '@/lib/owner';
import { normalizeRole, type AdminRole } from '@/lib/roles';

/**
 * Result of an access check: either the verified caller, or the response to
 * return. `role` is the caller's effective role — the owner is always 'admin'.
 */
type AdminCheck =
  | { ok: true; uid: string; email: string; role: AdminRole; isOwner: boolean }
  | { ok: false; response: NextResponse };

/**
 * Verifies the caller holds any row in /admins, and reports which role.
 *
 * These routes run with Admin SDK credentials, which bypass Firestore rules
 * entirely — so the rules are no defence here and the check has to happen in
 * the route itself. Callers send the Firebase ID token as a bearer token; we
 * verify the signature and then look the caller up in /admins by email.
 *
 * Use this only for things a chair may also do. Everything else wants
 * requireAdmin.
 */
export async function requireStaff(req: NextRequest): Promise<AdminCheck> {
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
    console.error('[requireStaff] Admin SDK unavailable:', error);
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

  // The owner is a full admin unconditionally, so an empty or mangled /admins
  // collection cannot lock the last person capable of repairing it out.
  if (isOwnerEmail(email)) {
    return { ok: true, uid, email, role: 'admin', isOwner: true };
  }

  const adminDoc = await getAdminDB().collection('admins').doc(adminDocId(email)).get();
  if (!adminDoc.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    uid,
    email,
    role: normalizeRole(adminDoc.data()?.role),
    isOwner: false,
  };
}

/**
 * Verifies the caller is a full admin. Chairs are rejected: they may create
 * events and nothing else, and every route guarded by this one touches student
 * data or dashboard-wide state.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminCheck> {
  const check = await requireStaff(req);
  if (!check.ok) return check;

  if (check.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Chairs can only create events.' },
        { status: 403 }
      ),
    };
  }

  return check;
}

/**
 * Verifies the caller is the owner — the single account permitted to change who
 * is an admin, and what role they hold.
 */
export async function requireOwner(req: NextRequest): Promise<AdminCheck> {
  const check = await requireAdmin(req);
  if (!check.ok) return check;

  if (!check.isOwner) {
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
