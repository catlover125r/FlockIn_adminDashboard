import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB } from '@/lib/firebaseAdmin';
import { requireAdmin, requireOwner } from '@/lib/requireAdmin';
import { adminDocId, isOwnerEmail, OWNER_EMAIL } from '@/lib/owner';

/**
 * The admin list.
 *
 * Reading is open to any admin; adding and removing is restricted to the owner
 * (see requireOwner). Firestore rules deny all client writes to /admins, so
 * this route is the only way in, and it runs with Admin SDK credentials that
 * bypass those rules — which is exactly why the owner check has to live here
 * rather than in the rules.
 */

interface AdminRow {
  id: string;
  email: string;
  name: string;
  addedBy?: string;
  addedAt?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const snap = await getAdminDB().collection('admins').orderBy('email').get();

  const admins: AdminRow[] = snap.docs.map((d) => {
    const data = d.data();
    const addedAt = data.addedAt;
    return {
      id: d.id,
      email: (data.email as string) ?? '',
      name: (data.name as string) ?? '',
      addedBy: data.addedBy as string | undefined,
      // Timestamps do not survive JSON, so send an ISO string the client can
      // render directly rather than a {_seconds} blob it has to reconstruct.
      addedAt:
        addedAt && typeof addedAt.toDate === 'function'
          ? addedAt.toDate().toISOString()
          : undefined,
    };
  });

  return NextResponse.json({
    admins,
    ownerEmail: OWNER_EMAIL,
    isOwner: isOwnerEmail(auth.email),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  let body: { email?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

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
    addedBy: auth.email,
    addedAt: new Date(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!id) {
    return NextResponse.json({ error: 'Missing admin id.' }, { status: 400 });
  }

  // The owner is an admin by virtue of OWNER_EMAIL, not by virtue of this row,
  // so deleting it would not actually revoke anything — it would just make the
  // list lie about who has access. Refuse rather than allow that drift.
  if (id === adminDocId(OWNER_EMAIL)) {
    return NextResponse.json(
      { error: 'The owner cannot be removed.' },
      { status: 400 }
    );
  }

  await getAdminDB().collection('admins').doc(id).delete();

  return NextResponse.json({ ok: true });
}
