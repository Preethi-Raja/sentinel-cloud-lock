import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  auth,
  onAuthStateChanged,
  firebaseSignOut,
  type FirebaseUser,
} from '@/lib/firebase';

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// Expose a user object with `id` mapped from Firebase `uid` for compatibility
export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => void;
  timeRemaining: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  signOut: async () => {},
  refreshSession: () => {},
  timeRemaining: 0,
});

function toAppUser(fbUser: FirebaseUser): AppUser {
  return {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginTime, setLoginTime] = useState<number>(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(SESSION_TIMEOUT);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setFirebaseUser(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(() => {
    setLoginTime(Date.now());
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setUser(fbUser ? toAppUser(fbUser) : null);
      setLoading(false);
      if (fbUser) {
        setLoginTime(Date.now());
      }
    });
    return () => unsubscribe();
  }, []);

  // Session timeout
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - loginTime;
      const remaining = SESSION_TIMEOUT - elapsed;
      setTimeRemaining(Math.max(0, remaining));
      if (remaining <= 0) {
        signOut();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [user, loginTime, signOut]);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signOut, refreshSession, timeRemaining }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
