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
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED =
  'Sign-in is not configured for this deployment. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
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

  const user = session?.user ?? null;

  // Keep the local profile (name, email, avatar) in step with the signed-in account
  useEffect(() => {
    if (loading) return;
    if (user) {
      const meta = user.user_metadata ?? {};
      const email = user.email ?? '';
      applySessionProfile({
        id: user.id,
        email,
        name: String(meta.full_name || meta.name || email.split('@')[0] || ''),
        picture: typeof meta.avatar_url === 'string' ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : undefined,
        provider: user.app_metadata?.provider === 'google' ? 'google' : 'email',
      });
    } else {
      resetProfile();
    }
  }, [user, loading]);

  const openSignIn = useCallback((target?: string) => {
    setReturnTo(target ?? null);
    setModalOpen(true);
  }, []);
  const closeSignIn = useCallback(() => setModalOpen(false), []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return { error: error.message };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };
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
  }, [returnTo]);

  const signOut = useCallback(async () => {
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
      signInWithPassword,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [loading, user, modalOpen, returnTo, openSignIn, closeSignIn, signInWithPassword, signUp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
