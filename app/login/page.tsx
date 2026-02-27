'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithGoogle, isAdmin, signOut } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated as admin, redirect
  useEffect(() => {
    if (!loading && user) {
      isAdmin(user.uid).then((admin) => {
        if (admin) router.replace('/');
      });
    }
  }, [user, loading, router]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setError(null);
    try {
      const firebaseUser = await signInWithGoogle();
      const adminCheck = await isAdmin(firebaseUser.uid);
      if (adminCheck) {
        router.replace('/');
      } else {
        await signOut();
        setError('Access denied. You are not an admin.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      if (message.includes('popup-closed-by-user') || message.includes('cancelled-popup-request')) {
        // User dismissed popup — not an error
      } else {
        setError(message);
      }
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #F8F8FA 50%, #ede9fe 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div className="flex flex-col items-center mb-8">
          {/* App icon */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 shadow-lg"
            style={{
              background: 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 100%)',
              boxShadow: '0 8px 32px rgba(139,92,246,0.35)',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Three person silhouettes */}
              {/* Center person */}
              <circle cx="20" cy="13" r="5" fill="white" />
              <path
                d="M11 33c0-4.97 4.03-9 9-9s9 4.03 9 9"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Left person */}
              <circle cx="9" cy="15" r="4" fill="white" fillOpacity="0.7" />
              <path
                d="M1 33c0-4.42 3.58-8 8-8"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                strokeOpacity="0.7"
              />
              {/* Right person */}
              <circle cx="31" cy="15" r="4" fill="white" fillOpacity="0.7" />
              <path
                d="M39 33c0-4.42-3.58-8-8-8"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
                strokeOpacity="0.7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Flock In</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Admin Dashboard</p>
        </div>

        {/* Sign in card */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-6">
            Sign in with your school Google account to continue.
          </p>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm animate-slide-up">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl px-4 py-3 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {signingIn ? (
              <>
                <svg className="animate-spin h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                {/* Google G logo */}
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Sign in with Google</span>
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
            Only authorized school administrators can access this dashboard.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date().getFullYear()} Flock In · ASB Events
        </p>
      </div>
    </div>
  );
}
