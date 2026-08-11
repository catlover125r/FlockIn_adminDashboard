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
import { onAuthChange, isAdmin, signOut } from '@/lib/firebase';
import { isOwnerEmail } from '@/lib/owner';

interface AuthContextValue {
  user: User | null;
  isAdminUser: boolean;
  /** The single account allowed to change the admin list. */
  isOwnerUser: boolean;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdminUser: false,
  isOwnerUser: false,
  loading: true,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isOwnerUser, setIsOwnerUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const adminStatus = await isAdmin(firebaseUser);
          setIsAdminUser(adminStatus);
        } catch {
          setIsAdminUser(false);
        }
        // Decides what the UI offers, nothing more. /api/admins re-checks the
        // owner against the verified token, so flipping this in devtools buys
        // a visible button and a 403.
        setIsOwnerUser(isOwnerEmail(firebaseUser.email));
        setUser(firebaseUser);
      } else {
        setUser(null);
        setIsAdminUser(false);
        setIsOwnerUser(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut();
    setUser(null);
    setIsAdminUser(false);
    setIsOwnerUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAdminUser, isOwnerUser, loading, signOutUser }}
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
