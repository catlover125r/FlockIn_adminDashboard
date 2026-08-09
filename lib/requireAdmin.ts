import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB, getAdminAuth } from '@/lib/firebaseAdmin';

/**
 * Result of an admin check: either the verified uid, or the response to return.
 */
type AdminCheck =
  | { ok: true; uid: string }
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

  let uid: string;
  try {
    // checkRevoked: a signed-out or disabled admin must stop working immediately,
    // not when their hour-long token happens to expire.
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    uid = decoded.uid;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const adminDoc = await getAdminDB().collection('admins').doc(uid).get();
  if (!adminDoc.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, uid };
}
