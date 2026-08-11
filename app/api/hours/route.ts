import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAdminDB, getAdminAuth } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/requireAdmin';
import { sanitizeEmailForDocId } from '@/lib/requireUser';

/**
 * Awards hours to one student directly, for work that never went through an
 * event — covering a shift nobody signed up for, making good on a check-in that
 * failed at the geofence, and so on.
 *
 * This writes a check-in and deliberately does NOT create an event. The iOS app
 * streams the whole /events collection to every student (FirestoreService.swift
 * streamEvents), so a one-student event would appear in all of their feeds. It
 * skips /signups for the same reason: signups are streamed per student, so the
 * award would show up as a phantom upcoming event in that student's app.
 *
 * Hours are computed by summing checkins.hoursEarned, so a check-in on its own
 * is both necessary and sufficient.
 *
 * Firestore rules deny this write from the browser: /checkins creates require a
 * matching signup that pins the hours, which is what stops a student minting
 * their own. Admin SDK credentials bypass the rules, so the admin check has to
 * happen here.
 */

const MAX_HOURS = 24;

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  let body: { email?: unknown; title?: unknown; hours?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const hours = typeof body.hours === 'number' ? body.hours : Number(body.hours);

  if (!email) {
    return NextResponse.json({ error: 'Missing student email.' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: 'Give the award a title.' }, { status: 400 });
  }
  if (!Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ error: 'Hours must be greater than 0.' }, { status: 400 });
  }
  if (hours > MAX_HOURS) {
    return NextResponse.json(
      { error: `Hours must be ${MAX_HOURS} or fewer.` },
      { status: 400 }
    );
  }

  const db = getAdminDB();
  const studentSnap = await db.collection('students').doc(sanitizeEmailForDocId(email)).get();
  if (!studentSnap.exists) {
    return NextResponse.json(
      { error: `${email} is not on the roster.` },
      { status: 404 }
    );
  }
  const student = studentSnap.data() ?? {};

  // The student's uid is what lets them read their own check-in. It is on the
  // roster document once they have signed in at least once; fall back to Auth,
  // and accept an empty string for someone who never has. Dashboard totals key
  // off studentEmail either way, so the award still counts.
  let studentUid = (student.uid as string) ?? '';
  if (!studentUid) {
    try {
      studentUid = (await getAdminAuth().getUserByEmail(email)).uid;
    } catch {
      studentUid = '';
    }
  }

  const id = `manual_${randomUUID()}`;
  const now = new Date();

  await db.collection('checkins').doc(id).set({
    // No signup and no event back this award; the empty strings keep the shape
    // consistent for readers that expect the fields to be present.
    signupId: '',
    eventId: '',
    eventTitle: title,
    eventDate: now.toISOString().slice(0, 10),
    eventLocation: '',
    studentUid,
    studentEmail: email,
    studentName: (student.displayName as string) ?? email,
    checkedInAt: now,
    hoursEarned: hours,
    isManual: true,
    awardedBy: auth.email,
  });

  return NextResponse.json({ ok: true, id });
}
