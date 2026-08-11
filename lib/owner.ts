import { sanitizeEmail } from './types';

/**
 * The one account allowed to change who is an admin.
 *
 * This is a hardcoded constant rather than a flag stored in Firestore, and that
 * is the whole point: an owner flag living in the database would be editable by
 * anyone who can write the database, so the "only Luke can change admins" rule
 * would only ever be as strong as the weakest write path into it. A constant
 * can only be changed by editing this line and redeploying.
 *
 * Mirrored in firestore.rules — isOwner() there hardcodes the same address, so
 * both copies have to be updated together.
 */
export const OWNER_EMAIL = '818038@seq.org';

export function isOwnerEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === OWNER_EMAIL;
}

/**
 * Document ID for an admin, derived from their email.
 *
 * Admins are keyed by sanitized email rather than by uid so that someone can be
 * granted access before they have ever signed in — a uid does not exist until
 * the first successful authentication, which used to force every new admin
 * through a "sign in, get rejected, go read the uid out of the console" dance.
 *
 * Mirrors adminDocId() in firestore.rules.
 */
export function adminDocId(email: string): string {
  return sanitizeEmail(email.trim().toLowerCase());
}
