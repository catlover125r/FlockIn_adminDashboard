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

/**
 * Colour per role: admin in light purple, chair in light grey. Kept here so the
 * table, the dropdown and the sidebar badge cannot drift apart.
 *
 * These are literal class names on purpose — Tailwind scans for them as text,
 * so they can never be assembled from fragments at runtime. tailwind.config.ts
 * includes lib/ in `content` for this file specifically.
 */
export const ROLE_BADGE_CLASS: Record<AdminRole, string> = {
  admin: 'bg-violet-100 text-violet-700 border-violet-200',
  chair: 'bg-gray-100 text-gray-600 border-gray-300',
};
