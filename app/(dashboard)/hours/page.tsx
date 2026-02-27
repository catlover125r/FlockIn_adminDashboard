'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getCheckins, deleteDoc, doc, db } from '@/lib/firebase';
import type { Checkin } from '@/lib/types';
import { formatTimestamp } from '@/lib/types';

type Toast = { id: number; message: string; type: 'success' | 'error' };

interface StudentHours {
  name: string;
  email: string;
  totalHours: number;
  checkinCount: number;
}

export default function HoursPage() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState('');
  const [filterEvent, setFilterEvent] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmCheckin, setConfirmCheckin] = useState<Checkin | null>(null);

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const loadCheckins = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCheckins();
      setCheckins(data as Checkin[]);
    } catch {
      addToast('Failed to load check-ins', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCheckins();
  }, [loadCheckins]);

  // Compute hours per student
  const studentHours = useMemo<StudentHours[]>(() => {
    const map: Record<string, StudentHours> = {};
    checkins.forEach((c) => {
      if (!map[c.studentEmail]) {
        map[c.studentEmail] = {
          name: c.studentName,
          email: c.studentEmail,
          totalHours: 0,
          checkinCount: 0,
        };
      }
      map[c.studentEmail].totalHours += c.hoursEarned;
      map[c.studentEmail].checkinCount += 1;
    });
    return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
  }, [checkins]);

  // Total hours across all students
  const totalHours = useMemo(
    () => checkins.reduce((sum, c) => sum + c.hoursEarned, 0),
    [checkins]
  );

  // Filtered checkins
  const filteredCheckins = useMemo(() => {
    return checkins.filter((c) => {
      const matchStudent =
        !filterStudent ||
        c.studentEmail.toLowerCase().includes(filterStudent.toLowerCase()) ||
        c.studentName.toLowerCase().includes(filterStudent.toLowerCase());
      const matchEvent =
        !filterEvent ||
        c.eventTitle.toLowerCase().includes(filterEvent.toLowerCase());
      return matchStudent && matchEvent;
    });
  }, [checkins, filterStudent, filterEvent]);

  function exportCSV() {
    const headers = [
      'Student Name',
      'Student Email',
      'Event',
      'Event Date',
      'Location',
      'Hours Earned',
      'Checked In At',
    ];
    const rows = filteredCheckins.map((c) => [
      `"${c.studentName.replace(/"/g, '""')}"`,
      `"${c.studentEmail}"`,
      `"${c.eventTitle.replace(/"/g, '""')}"`,
      `"${c.eventDate}"`,
      `"${c.eventLocation.replace(/"/g, '""')}"`,
      c.hoursEarned,
      `"${formatTimestamp(c.checkedInAt)}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flock-in-checkins-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`Exported ${filteredCheckins.length} rows to CSV`, 'success');
  }

  async function deleteCheckin(checkin: Checkin) {
    setConfirmCheckin(null);
    setDeletingId(checkin.id);
    try {
      await deleteDoc(doc(db, 'checkins', checkin.id));
      if (checkin.signupId) {
        await deleteDoc(doc(db, 'signups', checkin.signupId));
      }
      setCheckins((prev) => prev.filter((c) => c.id !== checkin.id));
      addToast('Check-in deleted', 'success');
    } catch {
      addToast('Failed to delete check-in', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const topStudents = studentHours.slice(0, 5);

  return (
    <div>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
              toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hours</h1>
          <p className="text-sm text-gray-500 mt-1">
            {checkins.length} total check-in{checkins.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)} hours earned
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={loading || checkins.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Top students by hours */}
      {!loading && topStudents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Top Students by Hours</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topStudents.map((s, i) => (
              <div
                key={s.email}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 relative overflow-hidden"
              >
                {/* Rank badge */}
                <div
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: i === 0 ? '#FEF3C7' : i === 1 ? '#F1F5F9' : i === 2 ? '#FEF3C7' : '#F9FAFB',
                    color: i === 0 ? '#B45309' : i === 1 ? '#64748B' : i === 2 ? '#92400E' : '#9CA3AF',
                  }}
                >
                  {i + 1}
                </div>
                <div className="font-semibold text-sm text-gray-900 mb-0.5 pr-8 truncate">{s.name}</div>
                <div className="text-xs text-gray-400 truncate mb-3">{s.email}</div>
                <div className="flex items-end gap-1">
                  <span className="text-2xl font-bold text-violet-600">{s.totalHours.toFixed(1)}</span>
                  <span className="text-sm text-gray-400 mb-0.5">hrs</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{s.checkinCount} check-in{s.checkinCount !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={filterStudent}
            onChange={(e) => setFilterStudent(e.target.value)}
            placeholder="Filter by student..."
            className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-60"
          />
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <input
            type="text"
            value={filterEvent}
            onChange={(e) => setFilterEvent(e.target.value)}
            placeholder="Filter by event..."
            className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent w-60"
          />
        </div>
        {(filterStudent || filterEvent) && (
          <button
            onClick={() => { setFilterStudent(''); setFilterEvent(''); }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results summary */}
      {(filterStudent || filterEvent) && (
        <p className="text-xs text-gray-500 mb-3">
          Showing {filteredCheckins.length} of {checkins.length} check-ins
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filteredCheckins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {filterStudent || filterEvent ? 'No check-ins match your filters' : 'No check-ins yet'}
            </p>
            <p className="text-xs text-gray-400">
              {filterStudent || filterEvent
                ? 'Try clearing your filters'
                : 'Check-ins will appear here once students start attending events'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Student</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Event</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Hours</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Checked In</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCheckins.map((checkin) => (
                  <tr key={checkin.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm text-gray-900">{checkin.studentName}</div>
                      <div className="text-xs text-gray-400">{checkin.studentEmail}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{checkin.eventTitle}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{checkin.eventDate}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{checkin.eventLocation}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                        {checkin.hoursEarned}h
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {formatTimestamp(checkin.checkedInAt)}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setConfirmCheckin(checkin)}
                        disabled={deletingId === checkin.id}
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                        title="Delete check-in"
                      >
                        {deletingId === checkin.id ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Delete Check-in?</h2>
            <p className="text-sm text-gray-500 mb-4">
              This will permanently remove <span className="font-semibold text-gray-700">{confirmCheckin.studentName}</span>'s
              check-in for <span className="font-semibold text-gray-700">{confirmCheckin.eventTitle}</span> ({confirmCheckin.hoursEarned}h).
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCheckin(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCheckin(confirmCheckin)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer summary */}
      {!loading && filteredCheckins.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {filteredCheckins.length} record{filteredCheckins.length !== 1 ? 's' : ''}
          </p>
          <p className="text-xs font-semibold text-gray-600">
            Total hours (filtered):{' '}
            <span className="text-violet-600">
              {filteredCheckins.reduce((sum, c) => sum + c.hoursEarned, 0).toFixed(1)}h
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
