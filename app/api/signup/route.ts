import { NextRequest, NextResponse } from 'next/server';
import { getAdminDB } from '@/lib/firebaseAdmin';
import admin from '@/lib/firebaseAdmin';
import { requireUser, sanitizeEmailForDocId } from '@/lib/requireUser';

interface SignupBody {
  eventId: string;
  studentName?: string;
}

/** Demo accounts have no student record by design. Keep in sync with the
 *  isStaffAccount() carve-out in firestore.rules and AuthService.staffDomain. */
const STAFF_DOMAIN = '@flockin.local';

/** Sentinel errors thrown inside the transaction and mapped to responses. */
const ALREADY_SIGNED_UP = 'already_signed_up';
const EVENT_FULL = 'event_full';
const EVENT_NOT_FOUND = 'event_not_found';
const NOT_WHITELISTED = 'not_whitelisted';

/**
 * Creates a student's sign-up for an event.
 *
 * This lives on the server because capacity cannot be enforced in Firestore
 * rules: checking whether an event is full means counting its sign-ups, and
 * rules cannot count. It also can't be done from the app, because a student is
 * only permitted to read their own sign-ups. So the count happens here, with
 * Admin SDK credentials, inside a transaction — and firestore.rules denies
 * client-side creates outright so this path cannot be bypassed.
 *
 * The event snapshot written into the sign-up is read from the event document
 * server-side, so the client cannot influence the hours it will later earn.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { eventId, studentName } = (await req.json()) as SignupBody;
    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'missing_event_id' }, { status: 400 });
    }

    const db = getAdminDB();
    const eventRef = db.collection('events').doc(eventId);
    const signupRef = db.collection('signups').doc(`${eventId}_${auth.uid}`);
    const studentRef = db.collection('students').doc(sanitizeEmailForDocId(auth.email));
    const isStaff = auth.email.endsWith(STAFF_DOMAIN);

    await db.runTransaction(async (tx) => {
      const [eventSnap, signupSnap] = await Promise.all([
        tx.get(eventRef),
        tx.get(signupRef),
      ]);

      if (!eventSnap.exists) throw new Error(EVENT_NOT_FOUND);
      if (signupSnap.exists) throw new Error(ALREADY_SIGNED_UP);

      // Whitelist is re-checked on every sign-up: the app only consults it at
      // interactive sign-in, so a restored session would otherwise keep working
      // indefinitely after a student is removed.
      if (!isStaff) {
        const studentSnap = await tx.get(studentRef);
        if (!studentSnap.exists || studentSnap.data()?.isWhitelisted !== true) {
          throw new Error(NOT_WHITELISTED);
        }
      }

      const event = eventSnap.data()!;
      const positions = typeof event.positions === 'number' ? event.positions : 0;

      // positions === 0 means unlimited.
      if (positions > 0) {
        const taken = await tx.get(
          db.collection('signups').where('eventId', '==', eventId)
        );
        if (taken.size >= positions) throw new Error(EVENT_FULL);
      }

      tx.set(signupRef, {
        eventId,
        eventTitle: event.title ?? '',
        eventTask: event.task ?? '',
        eventDate: event.date ?? '',
        eventTime: event.time ?? '',
        eventLocation: event.location ?? '',
        eventLatitude: event.latitude ?? 0,
        eventLongitude: event.longitude ?? 0,
        eventHours: event.hours ?? 0,
        eventPositions: positions,
        studentUid: auth.uid,
        studentEmail: auth.email,
        studentName: studentName?.trim() || auth.email.split('@')[0],
        signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: event.isActive === true,
        isCheckedIn: false,
      });
    });

    return NextResponse.json({ id: signupRef.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    switch (message) {
      case ALREADY_SIGNED_UP:
        return NextResponse.json({ error: ALREADY_SIGNED_UP }, { status: 409 });
      case EVENT_FULL:
        return NextResponse.json({ error: EVENT_FULL }, { status: 409 });
      case EVENT_NOT_FOUND:
        return NextResponse.json({ error: EVENT_NOT_FOUND }, { status: 404 });
      case NOT_WHITELISTED:
        return NextResponse.json({ error: NOT_WHITELISTED }, { status: 403 });
      default:
        console.error('[signup] Unhandled error:', error);
        return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  }
}
