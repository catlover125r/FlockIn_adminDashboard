import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { adminDocId, isOwnerEmail } from './owner';
import { normalizeRole, type AdminRole } from './roles';
import type { Admin, EventMeta } from './types';

// authDomain must stay on <project>.firebaseapp.com. Firebase's sign-in helper
// hands Google a redirect_uri of https://<authDomain>/__/auth/handler, and the
// only value the project's OAuth client has registered is the firebaseapp.com
// one. Setting this to window.location.host — an attempt to keep the popup
// handshake first-party via a /__/auth/* reverse proxy — sent Google
// https://flock-in-admin-dashboard.vercel.app/__/auth/handler and every sign-in
// died on "Error 400: redirect_uri_mismatch".
//
// Serving the helper first-party is still the right answer if popup sign-in
// starts hanging under third-party storage blocking, but it takes a matching
// console change: add the app's own /__/auth/handler URL to the OAuth 2.0 web
// client in Google Cloud Console → Credentials, and the host to Firebase
// Console → Authentication → Settings → Authorized domains. Do not point
// authDomain anywhere the OAuth client does not already know about.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Prevent re-initialization during hot reloads
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── Auth helpers ────────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Popup-free sign-in, for machines where the popup is blocked outright or never
 * comes back. Navigates this tab to Google and returns to /login afterwards, so
 * it never resolves — the result is picked up by completeRedirectSignIn() on
 * the way back in.
 *
 * Escape hatch only: with a cross-origin authDomain this leans on third-party
 * storage surviving the round trip, so it is the more fragile of the two flows.
 * Keep signInWithPopup as the primary path.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(auth, googleProvider);
}

/**
 * Resolves the pending redirect sign-in, if this page load is the return leg.
 * Returns null on an ordinary page load.
 */
export async function completeRedirectSignIn(): Promise<User | null> {
  const result = await getRedirectResult(auth);
  return result?.user ?? null;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * This user's role, or null if they may not use the dashboard at all.
 *
 * Keyed by sanitized email rather than uid so the owner can grant access to
 * somebody who has not signed in yet. The owner short-circuits without a read
 * at all, which means a broken or empty /admins collection can never lock them
 * out of the page that repairs it.
 */
export async function getAdminRole(user: User): Promise<AdminRole | null> {
  if (isOwnerEmail(user.email)) return 'admin';
  if (!user.email) return null;
  try {
    const snap = await getDoc(doc(db, 'admins', adminDocId(user.email)));
    if (!snap.exists()) return null;
    return normalizeRole(snap.data().role);
  } catch {
    // A denied read means "not an admin" just as much as a missing document
    // does. Letting it throw put the raw "Missing or insufficient permissions"
    // on the login screen instead of the access-denied message.
    return null;
  }
}

/** Whether this user may sign in to the dashboard at all — chairs included. */
export async function isAdmin(user: User): Promise<boolean> {
  return (await getAdminRole(user)) !== null;
}

/**
 * Calls one of our API routes with the signed-in user's Firebase ID token
 * attached. Those routes run with Admin SDK credentials, so they verify this
 * token themselves rather than relying on Firestore rules.
 */
export async function requestAuthed(
  path: string,
  init: { method: string; body?: unknown } = { method: 'GET' }
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  return fetch(path, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function postAuthed(path: string, body: unknown): Promise<Response> {
  return requestAuthed(path, { method: 'POST', body });
}

/** Surfaces the API route's own error text, which is written to be shown. */
async function unwrap<T>(res: Response): Promise<T> {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error ?? 'Request failed');
  }
  return payload as T;
}

// ── Admins ───────────────────────────────────────────────────────────────────

export async function getAdmins(): Promise<{
  admins: Admin[];
  ownerEmail: string;
  isOwner: boolean;
}> {
  return unwrap(await requestAuthed('/api/admins'));
}

export async function addAdmin(
  email: string,
  name: string,
  role: AdminRole
): Promise<void> {
  await unwrap(
    await requestAuthed('/api/admins', { method: 'POST', body: { email, name, role } })
  );
}

export async function setAdminRole(id: string, role: AdminRole): Promise<void> {
  await unwrap(await requestAuthed('/api/admins', { method: 'PATCH', body: { id, role } }));
}

export async function removeAdmin(id: string): Promise<void> {
  await unwrap(
    await requestAuthed(`/api/admins?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  );
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function getEvents() {
  const snap = await getDocs(
    query(collection(db, 'events'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Creates an event and, alongside it, the authorship record.
 *
 * The two are written in one batch so an event can never exist without a note
 * of who made it — the whole point is that the log is complete. Authorship
 * lives in /eventMeta rather than on the event because students can read
 * /events and Firestore permissions cannot hide a single field.
 */
export async function createEvent(data: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in');

  // Generate the ID client-side so both documents can go in the same batch.
  const eventRef = doc(collection(db, 'events'));
  const batch = writeBatch(db);

  batch.set(eventRef, { ...data, createdAt: serverTimestamp() });
  batch.set(doc(db, 'eventMeta', eventRef.id), {
    createdBy: user.email.toLowerCase(),
    createdByName: user.displayName ?? '',
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return eventRef.id;
}

/**
 * Authorship for every event, as a map of event ID to record. Admin-only —
 * a chair calling this gets a permission error, so guard the call site.
 */
export async function getEventMeta(): Promise<Record<string, EventMeta>> {
  const snap = await getDocs(collection(db, 'eventMeta'));
  const byId: Record<string, EventMeta> = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    byId[d.id] = {
      createdBy: (data.createdBy as string) ?? '',
      createdByName: (data.createdByName as string) ?? '',
      createdAt: data.createdAt,
    };
  });
  return byId;
}

export async function updateEvent(id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, 'events', id), data);
}

export async function deleteEvent(id: string) {
  await deleteDoc(doc(db, 'events', id));
}

// ── Students ─────────────────────────────────────────────────────────────────

export async function getStudents() {
  const snap = await getDocs(
    query(collection(db, 'students'), orderBy('displayName', 'asc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addStudent(sanitizedEmail: string, data: Record<string, unknown>) {
  const ref = doc(db, 'students', sanitizedEmail);
  const existing = await getDoc(ref);
  // This used to be a whole-document setDoc, so re-importing the roster CSV
  // replaced each returning student's record outright: fcmToken, uid and
  // lastSignIn were dropped (silently breaking push for them) and createdAt
  // was reset to today. Merge, and only stamp createdAt on a genuinely new row.
  await setDoc(
    ref,
    existing.exists()
      ? { ...data, isWhitelisted: true }
      : { ...data, isWhitelisted: true, createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeStudent(sanitizedEmail: string) {
  await updateDoc(doc(db, 'students', sanitizedEmail), {
    isWhitelisted: false,
  });
}

// ── Signups ───────────────────────────────────────────────────────────────────

export async function getSignupsForEvent(eventId: string) {
  const snap = await getDocs(
    query(collection(db, 'signups'), where('eventId', '==', eventId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteSignup(signupId: string) {
  await deleteDoc(doc(db, 'signups', signupId));
}

/**
 * One student's check-ins. Deliberately unsorted in the query: pairing a
 * where() with an orderBy() on a different field needs a composite index, and
 * the result set here is one student's worth. Callers sort in memory.
 */
export async function getCheckinsByStudent(email: string) {
  const snap = await getDocs(
    query(collection(db, 'checkins'), where('studentEmail', '==', email))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function deleteCheckin(checkinId: string) {
  await deleteDoc(doc(db, 'checkins', checkinId));
}

/** Credits a student hours for work that never went through an event. */
export async function grantHours(
  email: string,
  title: string,
  hours: number
): Promise<void> {
  await unwrap(await requestAuthed('/api/hours', { method: 'POST', body: { email, title, hours } }));
}

export async function getSignupsByStudent(email: string) {
  const snap = await getDocs(
    query(collection(db, 'signups'), where('studentEmail', '==', email))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSignupCountsByStudent(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, 'signups'));
  const counts: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const email = (d.data().studentEmail as string) ?? '';
    counts[email] = (counts[email] ?? 0) + 1;
  });
  return counts;
}

export async function getHoursByStudent(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, 'checkins'));
  const hours: Record<string, number> = {};
  snap.docs.forEach((d) => {
    const email = (d.data().studentEmail as string) ?? '';
    hours[email] = (hours[email] ?? 0) + ((d.data().hoursEarned as number) ?? 0);
  });
  return hours;
}

// ── Checkins ──────────────────────────────────────────────────────────────────

export async function getCheckins() {
  const snap = await getDocs(
    query(collection(db, 'checkins'), orderBy('checkedInAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRecentCheckins(n = 10) {
  const snap = await getDocs(
    query(collection(db, 'checkins'), orderBy('checkedInAt', 'desc'), limit(n))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTodayCheckinCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const snap = await getDocs(
    query(
      collection(db, 'checkins'),
      where('checkedInAt', '>=', Timestamp.fromDate(startOfDay))
    )
  );
  return snap.size;
}

export {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  serverTimestamp,
  Timestamp,
};
