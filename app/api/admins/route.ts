import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { adminDocId, isOwnerEmail, OWNER_EMAIL } from '@/lib/owner';
import { normalizeRole, type AdminRole } from '@/lib/roles';

/**
 * The admin list.
 *
 * Any full admin may read it and change it — add, remove, and set roles. Chairs
 * are excluded entirely by requireAdmin.
 *
 * The owner is the one exception carved out of that: their row cannot be
 * removed or demoted by anybody, themselves included. It would not actually
 * revoke anything if it were — the owner is a full admin by virtue of their
 * address (lib/owner.ts), not by virtue of the row — so allowing it would only
 * let the table say something untrue, and would remove the guarantee that at
 * least one account can always repair the list.
 *
 * Firestore rules deny all client writes to /admins, so this route is the only
 * way in, and it runs with Admin SDK credentials that bypass those rules —
 * which is exactly why these checks have to live here rather than in the rules.
 */

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  addedBy?: string;
  addedAt?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  // Unordered read, sorted below. Ordering in the query would need
  // orderBy('role'), and Firestore drops documents that lack the field being
  // ordered on — the rows written before roles existed have no role field, so
  // they would silently disappear from the list.
  const snap = await getAdminDB().collection('admins').get();

  const admins: AdminRow[] = snap.docs.map((d) => {
    const data = d.data();
    const addedAt = data.addedAt;
    return {
      id: d.id,
      email: (data.email as string) ?? '',
      name: (data.name as string) ?? '',
      role: normalizeRole(data.role),
      addedBy: data.addedBy as string | undefined,
      // Timestamps do not survive JSON, so send an ISO string the client can
      // render directly rather than a {_seconds} blob it has to reconstruct.
      addedAt:
        addedAt && typeof addedAt.toDate === 'function'
          ? addedAt.toDate().toISOString()
          : undefined,
    };
  });

  // Admins first, then alphabetically within each role. Falls back to the email
  // for a row with no name so those sort somewhere stable rather than bunching
  // at the top under an empty string.
  const roleRank: Record<AdminRole, number> = { admin: 0, chair: 1 };
  admins.sort(
    (a, b) =>
      roleRank[a.role] - roleRank[b.role] ||
      (a.name || a.email).localeCompare(b.name || b.email, 'en', {
        sensitivity: 'base',
      })
  );

  return NextResponse.json({
    admins,
    ownerEmail: OWNER_EMAIL,
    isOwner: isOwnerEmail(auth.email),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { email?: unknown; name?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const role = normalizeRole(body.role);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const db = getAdminDB();
  const ref = db.collection('admins').doc(adminDocId(email));

  const existing = await ref.get();
  if (existing.exists) {
    return NextResponse.json(
      { error: `${email} is already an admin.` },
      { status: 409 }
    );
  }

  await ref.set({
    email,
    name: name || email,
    role,
    addedBy: auth.email,
    addedAt: new Date(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}

/** Changes an existing admin's role. Owner only, same as adding and removing. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { id?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json({ error: 'Missing admin id.' }, { status: 400 });
  }
  if (body.role !== 'admin' && body.role !== 'chair') {
    return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  }

  // The owner is a full admin by virtue of OWNER_EMAIL, which no stored role
  // can override. Demoting their row would change nothing except to make the
  // table claim something untrue.
  if (id === adminDocId(OWNER_EMAIL)) {
    return NextResponse.json(
      { error: "The owner's role cannot be changed." },
      { status: 400 }
    );
  }

  const ref = getAdminDB().collection('admins').doc(id);
  if (!(await ref.get()).exists) {
    return NextResponse.json({ error: 'That admin no longer exists.' }, { status: 404 });
  }

  await ref.update({ role: body.role });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) {
    return NextResponse.json({ error: 'Missing admin id.' }, { status: 400 });
  }

  // Applies to every caller including the owner themselves — see the note at
  // the top of this file.
  if (id === adminDocId(OWNER_EMAIL)) {
    return NextResponse.json(
      { error: 'The owner cannot be removed.' },
      { status: 400 }
    );
  }

  await getAdminDB().collection('admins').doc(id).delete();

  return NextResponse.json({ ok: true });
}
