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

export function getAdminDB() {
  const app = getAdminApp();
  return admin.firestore(app);
}

export function getAdminMessaging() {
  const app = getAdminApp();
  return admin.messaging(app);
}

export default admin;
