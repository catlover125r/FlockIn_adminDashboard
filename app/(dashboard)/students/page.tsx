'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getStudents,
  addStudent,
  removeStudent,
  getSignupCountsByStudent,
  getHoursByStudent,
} from '@/lib/firebase';
import type { Student } from '@/lib/types';
import { formatDate, sanitizeEmail } from '@/lib/types';
import StudentModal from '@/components/StudentModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import StudentSignupsModal from '@/components/StudentSignupsModal';

type Toast = { id: number; message: string; type: 'success' | 'error' };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});
  const [hoursByStudent, setHoursByStudent] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [csvUploading, setCsvUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [signupsStudent, setSignupsStudent] = useState<Student | null>(null);

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsData, counts, hours] = await Promise.all([
        getStudents() as Promise<Student[]>,
        getSignupCountsByStudent(),
        getHoursByStudent(),
      ]);
      setStudents(studentsData);
      setSignupCounts(counts);
      setHoursByStudent(hours);
    } catch {
      addToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const onFocus = () => loadData();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [loadData]);

  async function handleAddStudent(sanitizedEmail: string, data: { email: string; displayName: string }) {
    await addStudent(sanitizedEmail, data);
    addToast(`${data.displayName} added to whitelist`, 'success');
    await loadData();
  }

  async function handleRemoveStudent() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeStudent(removeTarget.id);
      addToast(`${removeTarget.displayName} removed from whitelist`, 'success');
      setRemoveTarget(null);
      await loadData();
    } catch {
      addToast('Failed to remove student', 'error');
    } finally {
      setRemoving(false);
    }
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    try {
      const text = await file.text();
      const entries = parseCSV(text);
      if (entries.length === 0) {
        addToast('No valid entries found in CSV', 'error');
        return;
      }
      let added = 0;
      let failed = 0;
      for (const entry of entries) {
        try {
          const cleanEmail = entry.email.trim().toLowerCase();
          await addStudent(sanitizeEmail(cleanEmail), {
            email: cleanEmail,
            displayName: entry.name,
          });
          added++;
        } catch {
          failed++;
        }
      }
      addToast(
        `Added ${added} student${added !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
        failed > 0 ? 'error' : 'success'
      );
      await loadData();
    } catch {
      addToast('Failed to parse CSV file', 'error');
    } finally {
      setCsvUploading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  }

  const whitelistedStudents = students.filter((s) => s.isWhitelisted);
  const filteredStudents = whitelistedStudents.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.email.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q)
    );
  });

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
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-1">
            {whitelistedStudents.length} whitelisted student{whitelistedStudents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCSVUpload}
            className="hidden"
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={csvUploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 text-sm disabled:opacity-50"
          >
            {csvUploading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
            Upload CSV
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 text-sm shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Student
          </button>
        </div>
      </div>

      {/* Summary stat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#8B5CF618' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Whitelisted</p>
            <p className="text-2xl font-bold text-gray-900">{loading ? '—' : whitelistedStudents.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#10B98118' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Signups</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '—' : Object.values(signupCounts).reduce((a, b) => a + b, 0)}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#3B82F618' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Avg Signups</p>
            <p className="text-2xl font-bold text-gray-900">
              {loading || whitelistedStudents.length === 0
                ? '—'
                : (
                    Object.values(signupCounts).reduce((a, b) => a + b, 0) /
                    whitelistedStudents.length
                  ).toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative max-w-sm">
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {searchQuery ? 'No students match your search' : 'No students yet'}
            </p>
            <p className="text-xs text-gray-400 mb-5">
              {searchQuery ? 'Try a different name or email' : 'Add students to the whitelist to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700"
              >
                Add Student
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date Added</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Signups</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Hours</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{
                            background: `hsl(${hashString(student.email) % 360}, 60%, 55%)`,
                          }}
                        >
                          {student.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-900">{student.displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {formatDate(student.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSignupsStudent(student)}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors cursor-pointer"
                      >
                        {signupCounts[student.email] ?? 0}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                        {(hoursByStudent[student.email] ?? 0).toFixed(1)}h
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setRemoveTarget(student)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-red-100 hover:text-red-600 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Student Modal */}
      <StudentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleAddStudent}
      />

      {/* Student Signups Modal */}
      <StudentSignupsModal
        student={signupsStudent}
        onClose={() => setSignupsStudent(null)}
        onSignupDeleted={(email) => {
          setSignupCounts((prev) => ({
            ...prev,
            [email]: Math.max(0, (prev[email] ?? 1) - 1),
          }));
        }}
      />

      {/* Remove Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove Student"
        message={`Are you sure you want to remove "${removeTarget?.displayName}" from the whitelist? They will no longer be able to access the app. Their data will be preserved.`}
        confirmLabel="Remove"
        confirmVariant="danger"
        loading={removing}
        onConfirm={handleRemoveStudent}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

// Simple string hash for deterministic avatar colors
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Parse CSV — handles both "email,name" and "name,email" column orders
function parseCSV(text: string): Array<{ email: string; name: string }> {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const results: Array<{ email: string; name: string }> = [];
  for (const line of lines) {
    const parts = line.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 2) continue;
    // Find whichever column is the email
    const emailIdx = emailRe.test(parts[0]) ? 0 : emailRe.test(parts[1]) ? 1 : -1;
    if (emailIdx === -1) continue; // skip header rows or invalid lines
    const email = parts[emailIdx].toLowerCase();
    const name = parts[emailIdx === 0 ? 1 : 0];
    if (name) results.push({ email, name });
  }
  return results;
}
