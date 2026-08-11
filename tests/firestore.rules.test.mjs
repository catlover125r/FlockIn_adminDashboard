import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
} from 'firebase/firestore';

// ../../firestore.rules — the file that gets pasted into the Firebase console.
const RULES = fileURLToPath(new URL('../../firestore.rules', import.meta.url));

const testEnv = await initializeTestEnvironment({
  projectId: 'flockin-rules-test',
  firestore: { rules: readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
});

// ── Fixtures ────────────────────────────────────────────────────────────────
const ALICE_UID = 'alice-uid';
const ALICE_EMAIL = 'alice.smith@seq.org';
const ALICE_DOC = 'alice_smith_at_seq_org';

const MALLORY_UID = 'mallory-uid';
const MALLORY_EMAIL = 'mallory@seq.org';
const MALLORY_DOC = 'mallory_at_seq_org';

const GHOST_UID = 'ghost-uid';           // removed from the whitelist
const GHOST_EMAIL = 'ghost@seq.org';
const GHOST_DOC = 'ghost_at_seq_org';

const STAFF_UID = 'staff-uid';
const STAFF_EMAIL = 'admin@flockin.local';

// Admins are keyed by sanitized email, not uid, so the seed below is written at
// the email-derived id and the uid here is deliberately unrelated to it.
const ADMIN_UID = 'admin-uid';
const ADMIN_EMAIL = 'boss@seq.org';
const ADMIN_DOC = 'boss_at_seq_org';

// The hardcoded owner from firestore.rules / lib/owner.ts. Deliberately given
// no row in /admins, so the tests prove the short-circuit works on its own.
const OWNER_UID = 'owner-uid';
const OWNER_EMAIL = '818038@seq.org';

// role: 'chair' — may create events and nothing else.
const CHAIR_UID = 'chair-uid';
const CHAIR_EMAIL = 'chair@seq.org';
const CHAIR_DOC = 'chair_at_seq_org';

// A row with no role field at all, as written before roles existed. Must be
// treated as a full admin, the same way normalizeRole() defaults.
const LEGACY_UID = 'legacy-uid';
const LEGACY_EMAIL = 'legacy@seq.org';
const LEGACY_DOC = 'legacy_at_seq_org';

const EVENT_ACTIVE = 'evt-active';
const EVENT_IDLE = 'evt-idle';

const sid = (evt, uid) => `${evt}_${uid}`;
const ALICE_SIGNUP = sid(EVENT_ACTIVE, ALICE_UID);
const MALLORY_SIGNUP = sid(EVENT_IDLE, MALLORY_UID);
const ALICE_SPARE = sid('evt-spare', ALICE_UID);

const signupDoc = (evt, uid, email, hours, active) => ({
  eventId: evt, eventTitle: 'Rally', eventTask: 'Setup', eventDate: '2026-01-01',
  eventTime: '10:00', eventLocation: 'Gym', eventLatitude: 0, eventLongitude: 0,
  eventHours: hours, eventPositions: 0,
  studentUid: uid, studentEmail: email, studentName: 'N',
  isActive: active, isCheckedIn: false,
});

await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins', ADMIN_DOC), { email: ADMIN_EMAIL, role: 'admin' });
  await setDoc(doc(db, 'admins', CHAIR_DOC), { email: CHAIR_EMAIL, role: 'chair' });
  await setDoc(doc(db, 'admins', LEGACY_DOC), { email: LEGACY_EMAIL });

  await setDoc(doc(db, 'students', ALICE_DOC), {
    email: ALICE_EMAIL, displayName: 'Alice', isWhitelisted: true, fcmToken: 'tok-alice',
  });
  await setDoc(doc(db, 'students', MALLORY_DOC), {
    email: MALLORY_EMAIL, displayName: 'Mallory', isWhitelisted: true,
  });
  await setDoc(doc(db, 'students', GHOST_DOC), {
    email: GHOST_EMAIL, displayName: 'Ghost', isWhitelisted: false,
  });

  // hours stored as an integer, the way the dashboard writes it
  await setDoc(doc(db, 'events', EVENT_ACTIVE), {
    title: 'Rally', task: 'Setup', date: '2026-01-01', time: '10:00',
    location: 'Gym', isActive: true, hours: 2, positions: 0,
  });
  await setDoc(doc(db, 'events', EVENT_IDLE), {
    title: 'Cleanup', task: 'Sweep', date: '2026-02-01', time: '09:00',
    location: 'Quad', isActive: false, hours: 3, positions: 0,
  });
  await setDoc(doc(db, 'events', 'evt-spare'), {
    title: 'Spare', task: 'x', date: '2026-03-01', time: '09:00',
    location: 'X', isActive: true, hours: 1, positions: 0,
  });

  // Sign-ups are created by POST /api/signup with Admin SDK credentials, so
  // seed them the same way here.
  await setDoc(doc(db, 'signups', ALICE_SIGNUP),
    signupDoc(EVENT_ACTIVE, ALICE_UID, ALICE_EMAIL, 2, true));
  await setDoc(doc(db, 'signups', MALLORY_SIGNUP),
    signupDoc(EVENT_IDLE, MALLORY_UID, MALLORY_EMAIL, 3, false));
  await setDoc(doc(db, 'signups', ALICE_SPARE),
    signupDoc('evt-spare', ALICE_UID, ALICE_EMAIL, 1, true));
});

const alice = testEnv.authenticatedContext(ALICE_UID, { email: ALICE_EMAIL }).firestore();
const mallory = testEnv.authenticatedContext(MALLORY_UID, { email: MALLORY_EMAIL }).firestore();
const ghost = testEnv.authenticatedContext(GHOST_UID, { email: GHOST_EMAIL }).firestore();
const staff = testEnv.authenticatedContext(STAFF_UID, { email: STAFF_EMAIL }).firestore();
const adminDb = testEnv.authenticatedContext(ADMIN_UID, { email: ADMIN_EMAIL }).firestore();
const owner = testEnv.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL }).firestore();
const chair = testEnv.authenticatedContext(CHAIR_UID, { email: CHAIR_EMAIL }).firestore();
const legacy = testEnv.authenticatedContext(LEGACY_UID, { email: LEGACY_EMAIL }).firestore();
const anon = testEnv.unauthenticatedContext().firestore();

// ── Test runner ─────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`); fail++; }
}

console.log('\nEvents');
await check('anonymous cannot read events', () =>
  assertFails(getDoc(doc(anon, 'events', EVENT_ACTIVE))));
await check('signed-in student can read events', () =>
  assertSucceeds(getDoc(doc(alice, 'events', EVENT_ACTIVE))));
await check('student cannot create an event', () =>
  assertFails(setDoc(doc(alice, 'events', 'forged'), { title: 'x', hours: 99 })));
await check('student cannot flip isActive on an event', () =>
  assertFails(updateDoc(doc(alice, 'events', EVENT_IDLE), { isActive: true })));
await check('admin can create an event', () =>
  assertSucceeds(setDoc(doc(adminDb, 'events', 'by-admin'), { title: 'x', hours: 1, isActive: false })));

console.log('\nStudent roster (PII)');
await check('student can read own record', () =>
  assertSucceeds(getDoc(doc(alice, 'students', ALICE_DOC))));
await check('student CANNOT read another student record', () =>
  assertFails(getDoc(doc(alice, 'students', MALLORY_DOC))));
await check('student CANNOT list the whole roster', () =>
  assertFails(getDocs(collection(alice, 'students'))));
await check('admin can list the roster', () =>
  assertSucceeds(getDocs(collection(adminDb, 'students'))));
await check('student can save own fcmToken', () =>
  assertSucceeds(updateDoc(doc(alice, 'students', ALICE_DOC), { fcmToken: 'new' })));
await check('student CANNOT re-whitelist themselves', () =>
  assertFails(updateDoc(doc(ghost, 'students', GHOST_DOC), { isWhitelisted: true })));
await check('student CANNOT change their own email', () =>
  assertFails(updateDoc(doc(alice, 'students', ALICE_DOC), { email: 'other@seq.org' })));

console.log('\nSignups (creation is server-only)');
await check('student CANNOT create a signup directly, even a well-formed one', () =>
  assertFails(setDoc(doc(mallory, 'signups', sid(EVENT_ACTIVE, MALLORY_UID)),
    signupDoc(EVENT_ACTIVE, MALLORY_UID, MALLORY_EMAIL, 2, true))));
await check('student CANNOT create a signup with inflated hours', () =>
  assertFails(setDoc(doc(mallory, 'signups', sid(EVENT_ACTIVE, MALLORY_UID)),
    signupDoc(EVENT_ACTIVE, MALLORY_UID, MALLORY_EMAIL, 500, true))));
await check('admin CANNOT bypass the endpoint from the browser either', () =>
  assertFails(setDoc(doc(adminDb, 'signups', 'admin-forged'),
    signupDoc(EVENT_ACTIVE, ADMIN_UID, 'boss@seq.org', 2, true))));
await check('student can read own signup', () =>
  assertSucceeds(getDoc(doc(alice, 'signups', ALICE_SIGNUP))));
await check('student CANNOT read another student signup', () =>
  assertFails(getDoc(doc(mallory, 'signups', ALICE_SIGNUP))));
await check('student CANNOT rewrite eventHours on own signup', () =>
  assertFails(updateDoc(doc(alice, 'signups', ALICE_SIGNUP), { eventHours: 99 })));
await check('student CANNOT rewrite studentUid on own signup', () =>
  assertFails(updateDoc(doc(alice, 'signups', ALICE_SIGNUP), { studentUid: MALLORY_UID })));
await check('student CANNOT flip isCheckedIn on an inactive event', () =>
  assertFails(updateDoc(doc(mallory, 'signups', MALLORY_SIGNUP), { isCheckedIn: true })));
await check('student can flip isCheckedIn while the event is active', () =>
  assertSucceeds(updateDoc(doc(alice, 'signups', ALICE_SIGNUP), { isCheckedIn: true })));
await check('student can cancel (delete) own signup', () =>
  assertSucceeds(deleteDoc(doc(alice, 'signups', ALICE_SPARE))));
await check('student CANNOT delete another student signup', () =>
  assertFails(deleteDoc(doc(mallory, 'signups', ALICE_SIGNUP))));

console.log('\nCheck-ins (hour fraud)');
const checkinFor = (signupId, evt, uid, email, hours) => ({
  signupId, eventId: evt, studentUid: uid, studentEmail: email, hoursEarned: hours,
});
await check('student CANNOT invent hours on a check-in', () =>
  assertFails(setDoc(doc(alice, 'checkins', ALICE_SIGNUP),
    checkinFor(ALICE_SIGNUP, EVENT_ACTIVE, ALICE_UID, ALICE_EMAIL, 500))));
await check('student CANNOT check in with a random doc id', () =>
  assertFails(setDoc(doc(alice, 'checkins', 'free-hours'),
    checkinFor(ALICE_SIGNUP, EVENT_ACTIVE, ALICE_UID, ALICE_EMAIL, 2))));
await check('student CANNOT check in on another student signup', () =>
  assertFails(setDoc(doc(mallory, 'checkins', ALICE_SIGNUP),
    checkinFor(ALICE_SIGNUP, EVENT_ACTIVE, MALLORY_UID, MALLORY_EMAIL, 2))));
await check('de-whitelisted student CANNOT check in', () =>
  assertFails(setDoc(doc(ghost, 'checkins', ALICE_SIGNUP),
    checkinFor(ALICE_SIGNUP, EVENT_ACTIVE, GHOST_UID, GHOST_EMAIL, 2))));
await check('student CANNOT check in before the admin activates the event', () =>
  assertFails(setDoc(doc(mallory, 'checkins', MALLORY_SIGNUP),
    checkinFor(MALLORY_SIGNUP, EVENT_IDLE, MALLORY_UID, MALLORY_EMAIL, 3))));
await check('student CAN check in legitimately (active event, real hours)', () =>
  assertSucceeds(setDoc(doc(alice, 'checkins', ALICE_SIGNUP),
    checkinFor(ALICE_SIGNUP, EVENT_ACTIVE, ALICE_UID, ALICE_EMAIL, 2))));
await check('student CANNOT check in twice for the same signup', () =>
  assertFails(setDoc(doc(alice, 'checkins', ALICE_SIGNUP),
    checkinFor(ALICE_SIGNUP, EVENT_ACTIVE, ALICE_UID, ALICE_EMAIL, 2))));
await check('student CANNOT edit their own check-in afterwards', () =>
  assertFails(updateDoc(doc(alice, 'checkins', ALICE_SIGNUP), { hoursEarned: 99 })));
await check('student CANNOT delete their own check-in', () =>
  assertFails(deleteDoc(doc(alice, 'checkins', ALICE_SIGNUP))));
await check('student CANNOT read another student check-in', () =>
  assertFails(getDoc(doc(mallory, 'checkins', ALICE_SIGNUP))));
await check('staff demo account is still allowed past the whitelist gate', async () => {
  // Seeded through the server path, then checked in from the app like a student.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'signups', sid(EVENT_ACTIVE, STAFF_UID)),
      signupDoc(EVENT_ACTIVE, STAFF_UID, STAFF_EMAIL, 2, true));
  });
  await assertSucceeds(setDoc(doc(staff, 'checkins', sid(EVENT_ACTIVE, STAFF_UID)),
    checkinFor(sid(EVENT_ACTIVE, STAFF_UID), EVENT_ACTIVE, STAFF_UID, STAFF_EMAIL, 2)));
});

console.log('\nAdmins collection');
await check('student CANNOT read the admins list', () =>
  assertFails(getDoc(doc(alice, 'admins', ADMIN_DOC))));
await check('student CAN read their own (absent) admin row', () =>
  assertSucceeds(getDoc(doc(alice, 'admins', ALICE_DOC))));
await check('admin CAN read the admins list', () =>
  assertSucceeds(getDocs(collection(adminDb, 'admins'))));
await check('nobody can write to admins, not even an admin', () =>
  assertFails(setDoc(doc(adminDb, 'admins', 'new-admin'), { email: 'x' })));
await check('admin can delete a check-in', () =>
  assertSucceeds(deleteDoc(doc(adminDb, 'checkins', ALICE_SIGNUP))));

console.log('\nOwner');
await check('owner is an admin with no row in /admins at all', () =>
  assertSucceeds(setDoc(doc(owner, 'events', 'by-owner'), { title: 'x', hours: 1, isActive: false })));
await check('owner CAN read the admins list', () =>
  assertSucceeds(getDocs(collection(owner, 'admins'))));
// The owner-only write path is /api/admins, which runs with Admin SDK
// credentials. The browser must not be able to shortcut it, or an XSS on the
// dashboard could appoint admins straight out of the owner's own session.
await check('owner CANNOT write to admins from the browser', () =>
  assertFails(setDoc(doc(owner, 'admins', 'sneaky_at_seq_org'), { email: 'sneaky@seq.org' })));
await check('owner CANNOT delete an admin from the browser', () =>
  assertFails(deleteDoc(doc(owner, 'admins', ADMIN_DOC))));
// Admin identity is the email claim, not the uid: a uid that happens to match
// nothing and an unrelated email must not inherit anyone's access.
await check('impersonating the admin uid without their email grants nothing', () =>
  assertFails(setDoc(
    doc(testEnv.authenticatedContext(ADMIN_UID, { email: MALLORY_EMAIL }).firestore(),
      'events', 'forged-by-uid'),
    { title: 'x', hours: 1, isActive: false })));

console.log('\nChair role');
await check('chair CAN create an event', () =>
  assertSucceeds(setDoc(doc(chair, 'events', 'by-chair'),
    { title: 'x', task: 'y', date: '2026-01-01', time: '10:00', location: 'Gym', hours: 1, isActive: false })));
// Editing is how an event gets activated, which is what releases check-in.
// "Create-only" has to mean create only, or a chair can grant hours at will.
await check('chair CANNOT edit an event', () =>
  assertFails(updateDoc(doc(chair, 'events', EVENT_IDLE), { title: 'renamed' })));
await check('chair CANNOT activate an event', () =>
  assertFails(updateDoc(doc(chair, 'events', EVENT_IDLE), { isActive: true })));
await check('chair CANNOT delete an event', () =>
  assertFails(deleteDoc(doc(chair, 'events', EVENT_IDLE))));
await check('chair CANNOT read the student roster', () =>
  assertFails(getDocs(collection(chair, 'students'))));
await check('chair CANNOT read a single student record', () =>
  assertFails(getDoc(doc(chair, 'students', ALICE_DOC))));
await check('chair CANNOT read check-ins', () =>
  assertFails(getDocs(collection(chair, 'checkins'))));
await check('chair CANNOT write a check-in', () =>
  assertFails(setDoc(doc(chair, 'checkins', 'forged-by-chair'),
    { studentUid: CHAIR_UID, hoursEarned: 99, signupId: 'x', eventId: EVENT_ACTIVE })));
await check('chair CANNOT read sign-ups', () =>
  assertFails(getDocs(collection(chair, 'signups'))));
await check('chair CANNOT read the admins list', () =>
  assertFails(getDocs(collection(chair, 'admins'))));
await check('chair CAN read their own admin row', () =>
  assertSucceeds(getDoc(doc(chair, 'admins', CHAIR_DOC))));
await check('chair CANNOT promote themselves', () =>
  assertFails(updateDoc(doc(chair, 'admins', CHAIR_DOC), { role: 'admin' })));
await check('chair can still read events', () =>
  assertSucceeds(getDoc(doc(chair, 'events', EVENT_ACTIVE))));

console.log('\nRole defaulting');
await check('a row with no role field is a full admin', () =>
  assertSucceeds(setDoc(doc(legacy, 'events', 'by-legacy'), { title: 'x', hours: 1, isActive: false })));
await check('a row with no role field can read the roster', () =>
  assertSucceeds(getDocs(collection(legacy, 'students'))));
await check('a row with no role field can edit events', () =>
  assertSucceeds(updateDoc(doc(legacy, 'events', EVENT_IDLE), { isActive: false })));

console.log(`\n${pass} passed, ${fail} failed\n`);
await testEnv.cleanup();
process.exit(fail === 0 ? 0 : 1);
