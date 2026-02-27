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

interface AuthContextValue {
  user: User | null;
  isAdminUser: boolean;
  loading: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdminUser: false,
  loading: true,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const adminStatus = await isAdmin(firebaseUser.uid);
        setIsAdminUser(adminStatus);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setIsAdminUser(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut();
    setUser(null);
    setIsAdminUser(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAdminUser, loading, signOutUser }}>
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
