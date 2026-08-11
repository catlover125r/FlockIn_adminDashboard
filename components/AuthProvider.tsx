'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import type { User } from 'firebase/auth';
import { onAuthChange, getAdminRole, signOut } from '@/lib/firebase';
import { isOwnerEmail } from '@/lib/owner';
import type { AdminRole } from '@/lib/roles';

interface AuthContextValue {
  user: User | null;
  /** May use the dashboard at all — chairs included. */
  isAdminUser: boolean;
  /** Full access. False for chairs, who may only create events. */
  isFullAdmin: boolean;
  isChairUser: boolean;
  /** The single account allowed to change the admin list. */
  isOwnerUser: boolean;
  role: AdminRole | null;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdminUser: false,
  isFullAdmin: false,
  isChairUser: false,
  isOwnerUser: false,
  role: null,
  loading: true,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [isOwnerUser, setIsOwnerUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setRole(await getAdminRole(firebaseUser));
        } catch {
          setRole(null);
        }
        // Decides what the UI offers, nothing more. The API routes re-check the
        // caller's role against the verified token and Firestore rules gate the
        // direct writes, so flipping this in devtools buys a visible button and
        // a permission error.
        setIsOwnerUser(isOwnerEmail(firebaseUser.email));
        setUser(firebaseUser);
      } else {
        setUser(null);
        setRole(null);
        setIsOwnerUser(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut();
    setUser(null);
    setRole(null);
    setIsOwnerUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdminUser: role !== null,
        isFullAdmin: role === 'admin',
        isChairUser: role === 'chair',
        isOwnerUser,
        role,
        loading,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Hook that redirects to /login if the user is not an authenticated admin
export function useRequireAdmin() {
  const { user, isAdminUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdminUser) {
      router.replace('/login');
    }
  }, [user, isAdminUser, loading, router]);

  return { user, isAdminUser, loading };
}

/**
 * Guard for pages a chair may not open. Chairs are signed in legitimately, so
 * they go to the one page they can use rather than back to /login, which would
 * look like their account had stopped working.
 *
 * Cosmetic on its own — Firestore rules and the API routes are what actually
 * refuse the data. This just avoids rendering a page of permission errors.
 */
export function useRequireFullAdmin() {
  const { isFullAdmin, isChairUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (isChairUser) router.replace('/events');
  }, [isChairUser, loading, router]);

  return { isFullAdmin, isChairUser, loading };
}
