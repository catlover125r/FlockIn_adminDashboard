/** @type {import('next').NextConfig} */

// There used to be a rewrite here proxying /__/auth/* to
// <project>.firebaseapp.com, paired with authDomain = window.location.host, to
// keep Firebase's sign-in helper first-party. It broke sign-in outright: Google
// only accepts the redirect_uri registered on the project's OAuth client, and
// that is https://flockin-eee84.firebaseapp.com/__/auth/handler. See the note
// in lib/firebase.ts for what re-enabling it would require.
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
};

export default nextConfig;
