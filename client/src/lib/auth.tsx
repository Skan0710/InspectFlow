import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isAuthConfigured, supabase } from './supabase';
import { applySessionProfile, resetProfile } from './profile';

export type AuthStatus = 'loading' | 'guest' | 'authenticated';

export interface AuthResult {
  error: string | null;
  /** Sign-up succeeded but the project requires the address to be confirmed first. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  configured: boolean;
  modalOpen: boolean;
  /** Route to return to once the user signs in */
  returnTo: string | null;
  openSignIn: (returnTo?: string) => void;
  closeSignIn: () => void;
  clearReturnTo: () => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signInDemo: (custom?: { email?: string; name?: string; role?: string }) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_SESSION_KEY = 'insightflow.auth.demo.v1';
const RETURN_KEY = 'insightflow.auth.return.v1';

function readReturn(): string | null {
  try {
    return sessionStorage.getItem(RETURN_KEY);
  } catch {
    return null;
  }
}

export function consumeReturnTo(): string | null {
  const value = readReturn();
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // ignore
  }
  return value;
}

function readDemoUser(): User | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function createMockUser(custom?: { email?: string; name?: string; role?: string; provider?: 'demo' | 'google' }): User {
  const email = custom?.email?.trim() || 'alex.chen@innovatecorp.ai';
  const name =
    custom?.name?.trim() ||
    (custom?.email
      ? custom.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Alex Chen');
  const role = custom?.role?.trim() || 'Lead Product Manager';
  const provider = custom?.provider || 'demo';

  return {
    id: 'demo-user-' + Date.now(),
    app_metadata: { provider },
    user_metadata: {
      full_name: name,
      name,
      role,
      avatar_url:
        provider === 'google'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : undefined,
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email,
  } as unknown as User;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [demoUser, setDemoUser] = useState<User | null>(() => readDemoUser());
  const [loading, setLoading] = useState(isAuthConfigured);
  const [modalOpen, setModalOpen] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => active && setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? demoUser ?? null;

  // Keep the local profile (name, email, avatar) in step with the signed-in account
  useEffect(() => {
    if (loading) return;
    if (user) {
      const meta = user.user_metadata ?? {};
      const email = user.email ?? '';
      const provider =
        user.app_metadata?.provider === 'google'
          ? 'google'
          : user.app_metadata?.provider === 'demo'
          ? 'demo'
          : 'email';
      applySessionProfile({
        id: user.id,
        email,
        name: String(meta.full_name || meta.name || email.split('@')[0] || 'Demo User'),
        picture: typeof meta.avatar_url === 'string' ? meta.avatar_url : undefined,
        provider,
      });
    } else {
      resetProfile();
    }
  }, [user, loading]);

  const openSignIn = useCallback((target?: string) => {
    setReturnTo(target ?? null);
    setModalOpen(true);
  }, []);

  const clearReturnTo = useCallback(() => {
    setReturnTo(null);
    try {
      sessionStorage.removeItem(RETURN_KEY);
    } catch {
      // ignore
    }
  }, []);

  const closeSignIn = useCallback(() => {
    setModalOpen(false);
    clearReturnTo();
  }, [clearReturnTo]);

  const signInDemo = useCallback((custom?: { email?: string; name?: string; role?: string; provider?: 'demo' | 'google' }) => {
    const mock = createMockUser(custom);
    try {
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(mock));
    } catch {
      // ignore
    }
    setDemoUser(mock);
    setModalOpen(false);
  }, []);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) {
        // Fall back to demo sign in when environment is not yet configured
        signInDemo({ email });
        return { error: null };
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? error.message : null };
    },
    [signInDemo],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!supabase) {
        signInDemo({ email });
        return { error: null };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) return { error: error.message };
      return { error: null, needsConfirmation: !data.session };
    },
    [signInDemo],
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) {
      // Fall back to demo Google sign-in when environment is not yet configured
      signInDemo({
        email: 'alex.chen@innovatecorp.ai',
        name: 'Alex Chen',
        role: 'Lead Product Manager',
        provider: 'google',
      });
      return { error: null };
    }
    try {
      if (returnTo) sessionStorage.setItem(RETURN_KEY, returnTo);
    } catch {
      // ignore
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error: error ? error.message : null };
  }, [returnTo, signInDemo]);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
      sessionStorage.removeItem(RETURN_KEY);
    } catch {
      // ignore
    }
    setDemoUser(null);
    setReturnTo(null);
    if (supabase) await supabase.auth.signOut();
    resetProfile();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: loading ? 'loading' : user ? 'authenticated' : 'guest',
      user,
      configured: isAuthConfigured,
      modalOpen,
      returnTo,
      openSignIn,
      closeSignIn,
      clearReturnTo,
      signInWithPassword,
      signUp,
      signInWithGoogle,
      signInDemo,
      signOut,
    }),
    [loading, user, modalOpen, returnTo, openSignIn, closeSignIn, clearReturnTo, signInWithPassword, signUp, signInWithGoogle, signInDemo, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
