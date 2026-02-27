'use client';

import { useEffect, useState } from 'react';
import { getSignupsByStudent, deleteSignup } from '@/lib/firebase';
import type { Student } from '@/lib/types';

interface Signup {
  id: string;
  eventTitle: string;
  eventTask: string;
  eventDate: string;
  eventTime: string;
  isCheckedIn: boolean;
}

interface Props {
  student: Student | null;
  onClose: () => void;
  onSignupDeleted: (email: string) => void;
}

export default function StudentSignupsModal({ student, onClose, onSignupDeleted }: Props) {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    getSignupsByStudent(student.email)
      .then((data) => setSignups(data as Signup[]))
      .finally(() => setLoading(false));
  }, [student]);

  async function handleRemove(signupId: string) {
    setRemovingId(signupId);
    try {
      await deleteSignup(signupId);
      setSignups((prev) => prev.filter((s) => s.id !== signupId));
      onSignupDeleted(student!.email);
    } finally {
      setRemovingId(null);
    }
  }

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{student.displayName}'s Sign-ups</h2>
            <p className="text-xs text-gray-400">{student.email}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : signups.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No sign-ups found.</p>
          ) : (
            <div className="space-y-3">
              {signups.map((signup) => (
                <div
                  key={signup.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{signup.eventTitle}</span>
                      {signup.isCheckedIn && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                          Checked In
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{signup.eventTask}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {signup.eventDate} · {signup.eventTime}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(signup.id)}
                    disabled={removingId === signup.id}
                    className="ml-4 flex-shrink-0 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    {removingId === signup.id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400">{signups.length} sign-up{signups.length !== 1 ? 's' : ''}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
