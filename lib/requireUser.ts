import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

type UserCheck =
  | { ok: true; uid: string; email: string }
  | { ok: false; response: NextResponse };

/**
 * Verifies the caller is any signed-in Firebase user and returns their uid and
 * email. Use for student-facing endpoints; requireAdmin covers the rest.
 */
export async function requireUser(req: NextRequest): Promise<UserCheck> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    if (!decoded.email) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      };
    }
    return { ok: true, uid: decoded.uid, email: decoded.email.toLowerCase() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
}

/** Mirrors AuthService.sanitize() and the studentDocId() helper in the rules. */
export function sanitizeEmailForDocId(email: string): string {
  return email.toLowerCase().replace('@', '_at_').replace(/\./g, '_');
}
