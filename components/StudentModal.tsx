'use client';

import { useEffect, useState } from 'react';
import { sanitizeEmail } from '@/lib/types';

interface StudentFormData {
  email: string;
  displayName: string;
}

const emptyForm: StudentFormData = {
  email: '',
  displayName: '',
};

interface StudentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (sanitizedEmail: string, data: { email: string; displayName: string }) => Promise<void>;
}

export default function StudentModal({ open, onClose, onSave }: StudentModalProps) {
  const [form, setForm] = useState<StudentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setErrors({});
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  function validate(): boolean {
    const newErrors: Partial<Record<keyof StudentFormData, string>> = {};
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!form.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const cleanEmail = form.email.trim().toLowerCase();
      await onSave(sanitizeEmail(cleanEmail), {
        email: cleanEmail,
        displayName: form.displayName.trim(),
      });
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof StudentFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  if (!open) return null;

  const sanitizedPreview = form.email ? sanitizeEmail(form.email.trim().toLowerCase()) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add Student</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="student@school.edu"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            {sanitizedPreview && !errors.email && (
              <p className="mt-1 text-xs text-gray-400">
                Doc ID: <span className="font-mono text-gray-500">{sanitizedPreview}</span>
              </p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => update('displayName', e.target.value)}
              placeholder="Jane Smith"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition ${
                errors.displayName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            />
            {errors.displayName && <p className="mt-1 text-xs text-red-500">{errors.displayName}</p>}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-violet-600 leading-relaxed">
              The student will be added to the whitelist and can sign in to the Flock In app with this email.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            Add Student
          </button>
        </div>
      </div>
    </div>
  );
}
