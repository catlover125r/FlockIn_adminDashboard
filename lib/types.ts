import { Timestamp } from 'firebase/firestore';

export interface FlockEvent {
  id: string;
  title: string;
  task: string;
  date: string;         // ISO date e.g. "2025-02-04"
  positions: number;    // max sign-ups (0 = unlimited)
  time: string;         // 24h e.g. "14:30"
  location: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  hours: number;
  createdAt: Timestamp | Date | string;
}

export interface Student {
  id: string;           // sanitizedEmail used as doc ID
  email: string;
  displayName: string;
  isWhitelisted: boolean;
  fcmToken?: string;
  uid?: string;
  lastSignIn?: Timestamp | Date | string;
  createdAt?: Timestamp | Date | string;
}

export interface Signup {
  id: string;
  eventId: string;
  eventTitle: string;
  eventTask: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  studentUid: string;
  studentEmail: string;
  studentName: string;
  signedUpAt: Timestamp | Date | string;
  isActive: boolean;
  isCheckedIn: boolean;
}

export interface Checkin {
  id: string;
  signupId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  studentUid: string;
  studentEmail: string;
  studentName: string;
  checkedInAt: Timestamp | Date | string;
  hoursEarned: number;
}

export interface Admin {
  uid: string;
  email: string;
  name: string;
}

export interface NotifyPayload {
  title: string;
  body: string;
}

export interface NotifyResponse {
  sent: number;
  failed: number;
}

// Helper to sanitize email for Firestore doc ID
export function sanitizeEmail(email: string): string {
  return email.replace('@', '_at_').replace(/\./g, '_');
}

// Helper to format Firestore Timestamp or Date to readable string
export function formatTimestamp(ts: Timestamp | Date | string | undefined): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return ts;
  const date = ts instanceof Date ? ts : (ts as Timestamp).toDate();
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTime(ts: Timestamp | Date | string | undefined): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return ts;
  const date = ts instanceof Date ? ts : (ts as Timestamp).toDate();
  return date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(ts: Timestamp | Date | string | undefined): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return ts;
  const date = ts instanceof Date ? ts : (ts as Timestamp).toDate();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format an ISO date string (YYYY-MM-DD) or legacy display string for the UI
export function formatEventDate(date: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(date + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return date;
}

// Format a 24h time string (HH:MM) or legacy display string for the UI
export function formatEventTime(time: string): string {
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
  return time;
}
