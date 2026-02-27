import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function isAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
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
  await setDoc(doc(db, 'students', sanitizedEmail), {
    ...data,
    isWhitelisted: true,
    createdAt: serverTimestamp(),
  });
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
