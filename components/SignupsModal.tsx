'use client';

import { useEffect, useState } from 'react';
import { getSignupsForEvent, deleteSignup } from '@/lib/firebase';
import type { FlockEvent } from '@/lib/types';
import { formatTimestamp } from '@/lib/types';

interface Signup {
  id: string;
  studentName: string;
  studentEmail: string;
  signedUpAt: unknown;
  isCheckedIn: boolean;
}

interface SignupsModalProps {
  event: FlockEvent;
  onClose: () => void;
}

export default function SignupsModal({ event, onClose }: SignupsModalProps) {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    loadSignups();
  }, [event.id]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function loadSignups() {
    setLoading(true);
    const data = await getSignupsForEvent(event.id);
    setSignups(data as Signup[]);
    setLoading(false);
  }

  async function handleRemove(signupId: string) {
    setRemovingId(signupId);
    await deleteSignup(signupId);
    setSignups((prev) => prev.filter((s) => s.id !== signupId));
    setRemovingId(null);
  }

  const checkedIn = signups.filter((s) => s.isCheckedIn).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Sign-ups — {event.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {signups.length} signed up · {checkedIn} checked in
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : signups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">No sign-ups yet</p>
              <p className="text-xs text-gray-400 mt-1">Students will appear here once they sign up.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {signups.map((signup) => (
                <li key={signup.id} className="flex items-center gap-3 px-6 py-3.5">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-violet-700">
                      {signup.studentName?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{signup.studentName}</span>
                      {signup.isCheckedIn && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex-shrink-0">
                          ✓ Checked in
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{signup.studentEmail}</div>
                    <div className="text-xs text-gray-300 mt-0.5">{formatTimestamp(signup.signedUpAt as never)}</div>
                  </div>

                  {/* Remove */}
                  {!signup.isCheckedIn && (
                    <button
                      onClick={() => handleRemove(signup.id)}
                      disabled={removingId === signup.id}
                      className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition disabled:opacity-40 flex-shrink-0"
                    >
                      {removingId === signup.id ? '...' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
