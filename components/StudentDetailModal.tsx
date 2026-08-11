'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getSignupsByStudent,
  getCheckinsByStudent,
  deleteSignup,
  deleteCheckin,
  grantHours,
} from '@/lib/firebase';
import type { Student, Checkin, Signup } from '@/lib/types';
import { formatDate } from '@/lib/types';

interface Props {
  student: Student | null;
  onClose: () => void;
  /** Fires whenever hours or sign-ups changed, so the table behind can refresh. */
  onChanged: () => void;
}

export default function StudentDetailModal({ student, onClose, onChanged }: Props) {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [awarding, setAwarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = student?.email;

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const [signupData, checkinData] = await Promise.all([
        getSignupsByStudent(email) as Promise<Signup[]>,
        getCheckinsByStudent(email) as Promise<Checkin[]>,
      ]);
      setSignups(signupData);
      // Sorted here rather than in the query — see getCheckinsByStudent.
      setCheckins(
        checkinData.sort((a, b) => toMillis(b.checkedInAt) - toMillis(a.checkedInAt))
      );
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (!student) return;
    setTitle('');
    setHours('');
    setError(null);
    load();
  }, [student, load]);

  const totalHours = checkins.reduce((sum, c) => sum + (c.hoursEarned ?? 0), 0);

  async function handleAward(e: React.FormEvent) {
    e.preventDefault();
    if (!student || awarding) return;
    const amount = Number(hours);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Hours must be greater than 0.');
      return;
    }
    setAwarding(true);
    setError(null);
    try {
      await grantHours(student.email, title.trim(), amount);
      setTitle('');
      setHours('');
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not award hours.');
    } finally {
      setAwarding(false);
    }
  }

  async function handleRemoveSignup(signupId: string) {
    setRemovingId(signupId);
    try {
      await deleteSignup(signupId);
      setSignups((prev) => prev.filter((s) => s.id !== signupId));
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRemoveCheckin(checkinId: string) {
    setRemovingId(checkinId);
    try {
      await deleteCheckin(checkinId);
      setCheckins((prev) => prev.filter((c) => c.id !== checkinId));
      onChanged();
    } finally {
      setRemovingId(null);
    }
  }

  if (!student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{student.displayName}</h2>
            <p className="text-xs text-gray-400 truncate">{student.email}</p>
          </div>
          <div className="flex items-center gap-4 flex-shrink-0 ml-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-violet-600 leading-none">
                {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(2)}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-1">
                Total hours
              </div>
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
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <>
              {/* Award form */}
              <form onSubmit={handleAward} className="bg-violet-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-violet-900 uppercase tracking-wide mb-3">
                  Award hours
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What for? e.g. Front office help"
                    className="flex-1 min-w-0 border border-violet-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                  <input
                    type="number"
                    required
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Hrs"
                    className="w-20 flex-shrink-0 border border-violet-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={awarding || !title.trim() || !hours}
                    className="flex-shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {awarding ? 'Adding…' : 'Add'}
                  </button>
                </div>
                {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
                <p className="text-[11px] text-violet-700/70 mt-2">
                  Counts toward their total straight away. Nothing is shown in the
                  student app and no event is created.
                </p>
              </form>

              {/* Hours */}
              <SectionHeading label="Hours" count={checkins.length} />
              {checkins.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">No hours yet.</p>
              ) : (
                <div className="space-y-2">
                  {checkins.map((checkin) => (
                    <div
                      key={checkin.id}
                      className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">
                            {checkin.eventTitle || 'Untitled'}
                          </span>
                          {checkin.isManual && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
                              Awarded
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(checkin.checkedInAt)}
                          {checkin.awardedBy ? ` · by ${checkin.awardedBy}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold text-violet-600">
                          {checkin.hoursEarned}h
                        </span>
                        <button
                          onClick={() => handleRemoveCheckin(checkin.id)}
                          disabled={removingId === checkin.id}
                          className="px-2.5 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        >
                          {removingId === checkin.id ? '…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sign-ups */}
              <SectionHeading label="Sign-ups" count={signups.length} />
              {signups.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">No sign-ups yet.</p>
              ) : (
                <div className="space-y-2">
                  {signups.map((signup) => (
                    <div
                      key={signup.id}
                      className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">
                            {signup.eventTitle}
                          </span>
                          {signup.isCheckedIn && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700">
                              Checked in
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {signup.eventTask ? `${signup.eventTask} · ` : ''}
                          {signup.eventDate} · {signup.eventTime}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveSignup(signup.id)}
                        disabled={removingId === signup.id}
                        className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        {removingId === signup.id ? '…' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
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

function SectionHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline gap-2 mt-6 mb-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h3>
      <span className="text-xs text-gray-300">{count}</span>
    </div>
  );
}

function toMillis(value: Checkin['checkedInAt']): number {
  if (!value) return 0;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  return value.toDate().getTime();
}
