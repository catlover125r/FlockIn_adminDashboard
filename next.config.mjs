/** @type {import('next').NextConfig} */

// Firebase's popup sign-in helper is served from <project>.firebaseapp.com.
// Loaded from this app it is a third-party origin, and the popup hands the
// credential back through a hidden iframe on that origin — which needs its own
// storage. Browsers that partition or block third-party storage (Chrome's
// current default) break that handshake, and the failure mode is silent:
// signInWithPopup never settles, so the login button spins forever with no
// error to go on.
//
// Proxying /__/auth/* through our own origin keeps the helper first-party and
// sidesteps the whole problem. lib/firebase.ts points authDomain at the
// browser's own host to match, so this works on localhost, on the Vercel
// domain, and on a custom domain later without further configuration.
const authHelperHost = `${
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'flockin-eee84'
}.firebaseapp.com`;

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: `https://${authHelperHost}/__/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
