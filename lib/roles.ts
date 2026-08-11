/**
 * What each person in /admins is allowed to do.
 *
 * - admin: everything in the dashboard except changing the admin list itself,
 *   which stays with the owner (see lib/owner.ts).
 * - chair: create events, and nothing else. No roster, no hours, no
 *   notifications, no admin list — the roster and check-in pages are student
 *   PII, and a chair has no reason to hold it.
 *
 * Enforced in three places, all of which have to agree: firestore.rules (the
 * client writes events directly, so this is the real gate), the /api routes
 * that run on Admin SDK credentials and bypass those rules, and the UI, which
 * only decides what to render.
 */
export type AdminRole = 'admin' | 'chair';

export const ADMIN_ROLES: { value: AdminRole; label: string; blurb: string }[] = [
  { value: 'admin', label: 'Admin', blurb: 'Full access, except changing this list' },
  { value: 'chair', label: 'Chair', blurb: 'Can only create events' },
];

/**
 * Rows written before roles existed have no role field and are full admins;
 * firestore.rules defaults the same way, via .get('role', 'admin').
 */
export function normalizeRole(value: unknown): AdminRole {
  return value === 'chair' ? 'chair' : 'admin';
}

export function roleLabel(role: AdminRole): string {
  return ADMIN_ROLES.find((r) => r.value === role)?.label ?? 'Admin';
}
