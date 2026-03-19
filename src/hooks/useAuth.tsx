import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => void;
  timeRemaining: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshSession: () => {},
  timeRemaining: 0,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginTime, setLoginTime] = useState<number>(Date.now());
  const [timeRemaining, setTimeRemaining] = useState(SESSION_TIMEOUT);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshSession = useCallback(() => {
    setLoginTime(Date.now());
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_IN') {
        setLoginTime(Date.now());
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshSession, timeRemaining }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
