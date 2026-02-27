'use client';

import { useEffect, useState } from 'react';
import type { FlockEvent } from '@/lib/types';

interface EventFormData {
  title: string;
  task: string;
  date: string;
  time: string;
  location: string;
  latitude: string;
  longitude: string;
  hours: string;
  positions: string;
}

const emptyForm: EventFormData = {
  title: '',
  task: '',
  date: '',
  time: '',
  location: '',
  latitude: '',
  longitude: '',
  hours: '',
  positions: '',
};

interface EventModalProps {
  open: boolean;
  event?: FlockEvent | null;
  onClose: () => void;
  onSave: (data: Omit<FlockEvent, 'id' | 'createdAt'>) => Promise<void>;
}

// Try to convert a legacy display date ("Tue, Feb 4") to ISO format
function parseToISODate(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
}

// Try to convert a legacy display time ("2:30 PM") to 24h format
function parseTo24hTime(timeStr: string): string {
  if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }
  return '';
}

export default function EventModal({ open, event, onClose, onSave }: EventModalProps) {
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({});

  const isEditing = Boolean(event);

  useEffect(() => {
    if (open) {
      if (event) {
        setForm({
          title: event.title,
          task: event.task,
          date: parseToISODate(event.date),
          time: parseTo24hTime(event.time),
          location: event.location,
          latitude: event.latitude != null ? String(event.latitude) : '',
          longitude: event.longitude != null ? String(event.longitude) : '',
          hours: event.hours != null ? String(event.hours) : '',
          positions: event.positions != null ? String(event.positions) : '',
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
    }
  }, [open, event]);

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
    const newErrors: Partial<Record<keyof EventFormData, string>> = {};
    if (!form.title.trim()) newErrors.title = 'Title is required';
    if (!form.task.trim()) newErrors.task = 'Task is required';
    if (!form.date) newErrors.date = 'Date is required';
    if (!form.time) newErrors.time = 'Time is required';
    if (!form.location.trim()) newErrors.location = 'Location is required';
    if (!form.hours.trim()) newErrors.hours = 'Hours is required';
    else if (isNaN(Number(form.hours)) || Number(form.hours) < 0) {
      newErrors.hours = 'Must be a valid positive number';
    }
    if (form.positions.trim() && (isNaN(Number(form.positions)) || !Number.isInteger(Number(form.positions)) || Number(form.positions) < 0)) {
      newErrors.positions = 'Must be a whole number (0 = unlimited)';
    }
    if (form.latitude && isNaN(parseFloat(form.latitude))) newErrors.latitude = 'Must be a valid number';
    if (form.longitude && isNaN(parseFloat(form.longitude))) newErrors.longitude = 'Must be a valid number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        title: form.title.trim(),
        task: form.task.trim(),
        date: form.date,
        time: form.time,
        location: form.location.trim(),
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        isActive: event?.isActive ?? false,
        hours: parseFloat(form.hours) || 0,
        positions: parseInt(form.positions, 10) || 0,
      });
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  }

  function update(field: keyof EventFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEditing ? 'Edit Event' : 'Add Event'}
          </h2>
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
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {/* Title */}
          <FormField label="Title" required error={errors.title}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Homecoming Rally"
              className={fieldClass(!!errors.title)}
            />
          </FormField>

          {/* Task */}
          <FormField label="Task" required error={errors.task}>
            <input
              type="text"
              value={form.task}
              onChange={(e) => update('task', e.target.value)}
              placeholder="e.g. Check in at the main entrance"
              className={fieldClass(!!errors.task)}
            />
          </FormField>

          {/* Date */}
          <FormField label="Date" required error={errors.date}>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update('date', e.target.value)}
              className={fieldClass(!!errors.date)}
            />
          </FormField>

          {/* Time + Hours row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Time" required error={errors.time}>
              <input
                type="time"
                value={form.time}
                onChange={(e) => update('time', e.target.value)}
                className={fieldClass(!!errors.time)}
              />
            </FormField>
            <FormField label="Hours" required error={errors.hours}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={form.hours}
                onChange={(e) => update('hours', e.target.value)}
                placeholder="1"
                className={fieldClass(!!errors.hours)}
              />
            </FormField>
          </div>

          {/* Positions */}
          <FormField label="Positions (0 = unlimited)" error={errors.positions}>
            <input
              type="number"
              min={0}
              step={1}
              value={form.positions}
              onChange={(e) => update('positions', e.target.value)}
              placeholder="0"
              className={fieldClass(!!errors.positions)}
            />
          </FormField>

          {/* Location */}
          <FormField label="Location" required error={errors.location}>
            <input
              type="text"
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              placeholder="e.g. Main Gymnasium"
              className={fieldClass(!!errors.location)}
            />
          </FormField>

          {/* Lat + Lng row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Latitude" error={errors.latitude}>
              <input
                type="text"
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) => update('latitude', e.target.value)}
                placeholder="37.3382"
                className={fieldClass(!!errors.latitude)}
              />
            </FormField>
            <FormField label="Longitude" error={errors.longitude}>
              <input
                type="text"
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) => update('longitude', e.target.value)}
                placeholder="-121.8863"
                className={fieldClass(!!errors.longitude)}
              />
            </FormField>
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
            {isEditing ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function fieldClass(hasError: boolean) {
  return `w-full px-3 py-2.5 rounded-xl border text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition ${
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
  }`;
}
