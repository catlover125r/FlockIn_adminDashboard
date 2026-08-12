'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAdmins, addAdmin, removeAdmin, setAdminRole } from '@/lib/firebase';
import type { Admin } from '@/lib/types';
import { formatTimestamp } from '@/lib/types';
import { ADMIN_ROLES, ROLE_BADGE_CLASS, roleLabel, type AdminRole } from '@/lib/roles';
import { useAuth, useRequireFullAdmin } from '@/components/AuthProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

type Toast = { id: number; message: string; type: 'success' | 'error' };

export default function AdminsPage() {
  // Every full admin can manage this list. The owner's privilege is not a gate
  // on the page but a property of one row — isOwnerRow() below is what keeps
  // their entry from being removed or demoted, by anyone.
  const { isFullAdmin } = useAuth();
  useRequireFullAdmin();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('admin');
  const [adding, setAdding] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Admin | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(message: string, type: 'success' | 'error') {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdmins();
      setAdmins(data.admins);
      setOwnerEmail(data.ownerEmail);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to load admins', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      await addAdmin(email.trim(), name.trim(), newRole);
      addToast(
        `${email.trim()} can now sign in as ${roleLabel(newRole).toLowerCase() === 'chair' ? 'a chair' : 'an admin'}.`,
        'success'
      );
      setEmail('');
      setName('');
      setNewRole('admin');
      await loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not add admin', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(admin: Admin, role: AdminRole) {
    if (role === admin.role) return;
    setSavingRoleId(admin.id);
    // Optimistic: the select should not snap back to the old value for the
    // length of a round trip. loadData() below reconciles either way.
    setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, role } : a)));
    try {
      await setAdminRole(admin.id, role);
      addToast(`${admin.email} is now ${role === 'chair' ? 'a chair' : 'an admin'}.`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not change role', 'error');
    } finally {
      setSavingRoleId(null);
      await loadData();
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await removeAdmin(removeTarget.id);
      addToast(`${removeTarget.email} is no longer an admin.`, 'success');
      setRemoveTarget(null);
      await loadData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not remove admin', 'error');
    } finally {
      setRemoving(false);
    }
  }

  const isOwnerRow = (admin: Admin) =>
    admin.email.toLowerCase() === ownerEmail.toLowerCase();

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Admins</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everyone who can sign in to this dashboard. Any admin can change this
          list; the owner&apos;s own row cannot be removed or changed by anyone.
        </p>
      </div>

      {/* Add form. The server enforces this too; hiding it just keeps the
          page honest for a chair who guesses the URL. */}
      {isFullAdmin && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-2xl shadow-card p-6 mb-6 flex flex-wrap items-end gap-4"
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              School email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="819263@seq.org"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Name <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Karan"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Role
            </label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as AdminRole)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400 ${ROLE_BADGE_CLASS[newRole]}`}
            >
              {ADMIN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>
      )}

      {isFullAdmin && (
        <p className="text-xs text-gray-400 mb-6 -mt-2">
          <span className="font-semibold text-gray-500">Admin</span> gets everything,
          including this page — they can add and remove other admins.{' '}
          <span className="font-semibold text-gray-500">Chair</span> can only create
          events — no roster, hours, or notifications. They do not need to have
          signed in before; access takes effect the next time they load the
          dashboard.
        </p>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">Loading...</div>
        ) : admins.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-400">
            No admins yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Added</th>
                  {isFullAdmin && (
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {admin.name || '—'}
                        </span>
                        {isOwnerRow(admin) && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 rounded-md px-1.5 py-0.5">
                            Owner
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{admin.email}</td>
                    <td className="px-6 py-4">
                      {/* The owner is a full admin by virtue of their address,
                          which no stored role can override — so there is
                          nothing here to change. */}
                      {isOwnerRow(admin) ? (
                        <span
                          className={`inline-block border rounded-lg px-2.5 py-1.5 text-sm font-medium ${ROLE_BADGE_CLASS.admin}`}
                        >
                          Admin
                        </span>
                      ) : isFullAdmin ? (
                        <select
                          value={admin.role}
                          disabled={savingRoleId === admin.id}
                          onChange={(e) =>
                            handleRoleChange(admin, e.target.value as AdminRole)
                          }
                          className={`border rounded-lg px-2.5 py-1.5 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50 ${ROLE_BADGE_CLASS[admin.role]}`}
                        >
                          {ADMIN_ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block border rounded-lg px-2.5 py-1.5 text-sm font-medium ${ROLE_BADGE_CLASS[admin.role]}`}
                        >
                          {roleLabel(admin.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {/* formatTimestamp passes strings through untouched, so
                          hand it a Date rather than a raw ISO string. */}
                      {admin.addedAt ? formatTimestamp(new Date(admin.addedAt)) : '—'}
                    </td>
                    {isFullAdmin && (
                      <td className="px-6 py-4 text-right">
                        {isOwnerRow(admin) ? (
                          <span className="text-xs text-gray-300">Cannot remove</span>
                        ) : (
                          <button
                            onClick={() => setRemoveTarget(admin)}
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove admin"
        message={
          removeTarget
            ? `${removeTarget.email} will lose access to the dashboard immediately. You can add them back at any time.`
            : ''
        }
        confirmLabel="Remove"
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slide-up ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
