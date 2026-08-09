import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// Prevent re-initialization across hot reloads in development
function getAdminApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const serviceAccountEnv = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (!serviceAccountEnv) {
    throw new Error(
      'FIREBASE_ADMIN_SERVICE_ACCOUNT environment variable is not set. ' +
        'Add the full service account JSON as a single-line string to your .env.local file.'
    );
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountEnv) as ServiceAccount;
  } catch {
    throw new Error(
      'Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT. ' +
        'Ensure it is valid JSON, minified to a single line.'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// These return types are written out rather than inferred. Inferred, they name
// the `admin` namespace, which is only in scope in this file — consumers then
// fail to typecheck with "Cannot find name 'admin'" pointing at the call site.
export function getAdminDB(): admin.firestore.Firestore {
  const app = getAdminApp();
  return admin.firestore(app);
}

/**
 * Auth bound to the initialized app.
 *
 * Reaching for a bare `admin.auth()` throws "the default Firebase app does not
 * exist" on a cold serverless instance, because nothing has called
 * getAdminApp() yet. Both token guards run before any Firestore access, so on
 * Vercel that throw landed inside their catch blocks and every caller — app and
 * dashboard alike — got a 401 that looked like a bad token.
 */
export function getAdminAuth(): admin.auth.Auth {
  const app = getAdminApp();
  return admin.auth(app);
}

export function getAdminMessaging(): admin.messaging.Messaging {
  const app = getAdminApp();
  return admin.messaging(app);
}

export default admin;
