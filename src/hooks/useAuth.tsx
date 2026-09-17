import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // Initialize auth with error handling
    const initializeAuth = async () => {
      try {
        // Set up auth state listener FIRST - this will handle session updates
        const { data: { subscription: authSubscription }, error: listenerError } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (mounted) {
              setSession(session);
              setUser(session?.user ?? null);
              setLoading(false);
            }
          }
        );

        if (listenerError) {
          console.error('Error setting up auth listener:', listenerError);
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        subscription = authSubscription;

        // Try to get existing session, but don't block if it fails
        // The listener will handle session updates anyway
        // Use a timeout to prevent hanging
        const sessionPromise = Promise.race([
          supabase.auth.getSession(),
          new Promise<{ data: { session: null }, error: null }>((resolve) => {
            setTimeout(() => resolve({ data: { session: null }, error: null }), 2000);
          }),
        ]);
        
        try {
          const { data: { session }, error: sessionError } = await sessionPromise as any;
          if (sessionError) {
            // If getSession fails (e.g., localStorage issues), don't block
            // The listener will still work and update state when session is available
            console.warn('Could not get initial session (non-blocking):', sessionError);
            if (mounted) {
              setLoading(false);
            }
            return;
          }
          
          if (mounted) {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        } catch (error) {
          // If getSession throws (e.g., AbortError), don't block initialization
          // The listener will handle session updates
          if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn('Session check aborted (localStorage issue) - continuing with listener only');
          } else {
            console.error('Error getting session:', error);
          }
          if (mounted) {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
