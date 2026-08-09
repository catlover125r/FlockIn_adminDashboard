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
  Timestamp,
} from 'firebase/firestore';

// next.config.mjs reverse-proxies /__/auth/* to <project>.firebaseapp.com, so
// the sign-in helper is available on whatever origin the app is being served
// from. Pointing authDomain at that origin keeps the popup handshake
// first-party; leaving it on firebaseapp.com makes it a cross-site iframe,
// which Chrome's third-party storage blocking silently breaks — signInWithPopup
// then hangs forever instead of failing.
//
// Every host reached this way still has to be listed under Firebase Console →
// Authentication → Settings → Authorized domains. The env var is the value used
// during SSR, where there is no window to read.
const authDomain =
  typeof window !== 'undefined'
    ? window.location.host
    : process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain,
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
 * This only works because /__/auth/* is proxied through our own origin (see
 * next.config.mjs); against the default firebaseapp.com authDomain the redirect
 * flow is the *more* fragile of the two, since it leans harder on third-party
 * storage surviving the round trip.
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

export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    // A denied read means "not an admin" just as much as a missing document
    // does. Letting it throw put the raw "Missing or insufficient permissions"
    // on the login screen instead of the access-denied message.
    return false;
  }
}

/**
 * POSTs JSON to one of our API routes with the signed-in user's Firebase ID
 * token attached. Those routes run with Admin SDK credentials, so they verify
 * this token themselves rather than relying on Firestore rules.
 */
export async function postAuthed(path: string, body: unknown): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  return fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function getEvents() {
  const snap = await getDocs(
    query(collection(db, 'events'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createEvent(data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, 'events'), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
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
