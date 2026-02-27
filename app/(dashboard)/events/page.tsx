'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/lib/firebase';
import type { FlockEvent } from '@/lib/types';
import { formatTimestamp, formatEventDate, formatEventTime } from '@/lib/types';
import EventModal from '@/components/EventModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import SignupsModal from '@/components/SignupsModal';

type Toast = { id: number; message: string; type: 'success' | 'error' };

export default function EventsPage() {
  const [events, setEvents] = useState<FlockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FlockEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FlockEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [signupsEvent, setSignupsEvent] = useState<FlockEvent | null>(null);

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data as FlockEvent[]);
    } catch {
      addToast('Failed to load events', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  async function sendNotification(title: string, body: string) {
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      });
    } catch {
      // Non-fatal: notification failure shouldn't block the UI
    }
  }

  async function handleSaveEvent(data: Omit<FlockEvent, 'id' | 'createdAt'>) {
    if (editingEvent) {
      await updateEvent(editingEvent.id, data);
      addToast('Event updated successfully', 'success');
      // If active was just turned on, notify
      if (data.isActive && !editingEvent.isActive) {
        await sendNotification(
          `${data.title} is now active!`,
          'You can check in now'
        );
      }
    } else {
      await createEvent(data);
      addToast('Event created successfully', 'success');
      // Notify all students about new event
      await sendNotification(
        `New Event: ${data.title}`,
        `${data.task} on ${formatEventDate(data.date)} at ${formatEventTime(data.time)}`
      );
    }
    await loadEvents();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      addToast('Event deleted', 'success');
      setDeleteTarget(null);
      await loadEvents();
    } catch {
      addToast('Failed to delete event', 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive(event: FlockEvent) {
    setTogglingId(event.id);
    const newActive = !event.isActive;
    try {
      await updateEvent(event.id, { isActive: newActive });
      if (newActive) {
        await sendNotification(
          `${event.title} is now active!`,
          'You can check in now'
        );
      }
      addToast(
        newActive ? 'Event is now active' : 'Event deactivated',
        'success'
      );
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, isActive: newActive } : e))
      );
    } catch {
      addToast('Failed to update event', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDuplicate(event: FlockEvent) {
    setDuplicatingId(event.id);
    try {
      await createEvent({
        title: `${event.title} (Copy)`,
        task: event.task,
        date: event.date,
        time: event.time,
        location: event.location,
        latitude: event.latitude ?? 0,
        longitude: event.longitude ?? 0,
        hours: event.hours ?? 1,
        positions: event.positions ?? 0,
        isActive: false,
      });
      addToast('Event duplicated', 'success');
      await loadEvents();
    } catch {
      addToast('Failed to duplicate event', 'error');
    } finally {
      setDuplicatingId(null);
    }
  }

  function openAdd() {
    setEditingEvent(null);
    setModalOpen(true);
  }

  function openEdit(event: FlockEvent) {
    setEditingEvent(event);
    setModalOpen(true);
  }

  return (
    <div>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
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
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-1">
            {events.length} event{events.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 text-sm shadow-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Event
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">No events yet</p>
            <p className="text-xs text-gray-400 mb-5">Create your first event to get started</p>
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700"
            >
              Add Event
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Title</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Task</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Time</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Hours</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Location</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {events.map((event) => (
                  <tr key={event.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <div className="font-medium text-sm text-gray-900">{event.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {(event.positions ?? 0) > 0 ? `${event.positions} spots` : 'Unlimited spots'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 line-clamp-1 max-w-[200px] block">{event.task}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatEventDate(event.date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatEventTime(event.time)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                        {event.hours ?? 0}h
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{event.location}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleActive(event)}
                        disabled={togglingId === event.id}
                        className="flex items-center gap-2 group"
                        title={event.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <span
                          className={`toggle-track ${event.isActive ? 'on' : ''} ${togglingId === event.id ? 'opacity-50' : ''}`}
                          style={{
                            background: event.isActive ? '#8B5CF6' : '#d1d5db',
                            display: 'inline-block',
                            width: 36,
                            height: 20,
                          }}
                        >
                          <span
                            className="toggle-thumb"
                            style={{ width: 16, height: 16 }}
                          />
                        </span>
                        <span className={`text-xs font-semibold ${event.isActive ? 'text-violet-600' : 'text-gray-400'}`}>
                          {event.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSignupsEvent(event)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-violet-100 hover:text-violet-700 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                          </svg>
                          Sign-ups
                        </button>
                        <button
                          onClick={() => handleDuplicate(event)}
                          disabled={duplicatingId === event.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-violet-100 hover:text-violet-700 transition disabled:opacity-50"
                        >
                          {duplicatingId === event.id ? (
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <rect x="9" y="9" width="13" height="13" rx="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          )}
                          Duplicate
                        </button>
                        <button
                          onClick={() => openEdit(event)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-violet-100 hover:text-violet-700 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(event)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-red-100 hover:text-red-600 transition"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                          Delete
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

      {/* Event Modal */}
      <EventModal
        open={modalOpen}
        event={editingEvent}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEvent}
      />

      {/* Sign-ups Modal */}
      {signupsEvent && (
        <SignupsModal
          event={signupsEvent}
          onClose={() => setSignupsEvent(null)}
        />
      )}

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Event"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Event"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
