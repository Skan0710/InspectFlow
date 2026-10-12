import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { consumeReturnTo, useAuth } from '../../lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GoogleLogo: React.FC = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const fieldClass =
  'w-full rounded-xl border border-white/15 bg-white/10 py-3 pl-11 pr-4 text-base text-white placeholder:text-indigo-200/70 transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 disabled:opacity-60';

export const SignInModal: React.FC = () => {
  const { modalOpen, closeSignIn, status, returnTo, configured, signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Once signed in (password or the Google redirect), close the dialog and go where the visitor was headed
  useEffect(() => {
    if (status !== 'authenticated') return;
    const target = returnTo ?? consumeReturnTo();
    if (modalOpen) closeSignIn();
    if (target && target !== '/') navigate(target, { replace: true });
  }, [status, modalOpen, returnTo, closeSignIn, navigate]);

  useEffect(() => {
    if (!modalOpen) return;
    emailRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeSignIn();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [modalOpen, closeSignIn]);

  if (!modalOpen || status === 'authenticated') return null;

  const emailError = touched && !EMAIL_PATTERN.test(email.trim()) ? 'Enter a valid email address' : null;
  const passwordError =
    touched && (mode === 'signup' ? password.length < 8 : password.length === 0)
      ? mode === 'signup'
        ? 'Use at least 8 characters'
        : 'Enter your password'
      : null;

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setNotice(null);
    setTouched(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTouched(true);
    setError(null);
    setNotice(null);
    if (!EMAIL_PATTERN.test(email.trim()) || (mode === 'signup' ? password.length < 8 : !password)) return;
    setBusy('password');
    const result =
      mode === 'signin' ? await signInWithPassword(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(null);
    if (result.error) setError(result.error);
    else if (result.needsConfirmation) setNotice('Check your inbox to confirm your email, then sign in.');
  };

  const google = async () => {
    if (busy) return;
    setError(null);
    setBusy('google');
    const result = await signInWithGoogle();
    // On success the browser leaves for Google, so only a failure comes back here
    if (result.error) {
      setError(result.error);
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-indigo-950/70 backdrop-blur-md" onClick={closeSignIn} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-title"
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-indigo-950/90 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8"
      >
        <button
          type="button"
          onClick={closeSignIn}
          aria-label="Close sign in"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-indigo-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="signin-title" className="text-2xl font-bold text-white">
          {mode === 'signin' ? 'Sign in' : 'Create your account'}
        </h2>
        <p className="mt-1 text-base text-indigo-100">
          {mode === 'signin' ? 'Welcome back to InsightFlow.' : 'Start turning feedback into actions.'}
        </p>

        {!configured && (
          <div role="alert" className="mt-5 flex gap-2.5 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3.5 text-sm text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Sign-in isn’t configured yet. Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono">client/.env</code>.
            </span>
          </div>
        )}

        <form onSubmit={submit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-white">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-200" />
              <input
                ref={emailRef}
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy !== null}
                aria-invalid={Boolean(emailError)}
                placeholder="you@company.com"
                className={fieldClass}
              />
            </div>
            {emailError && <p className="mt-1.5 text-sm text-rose-300">{emailError}</p>}
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-white">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-200" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy !== null}
                aria-invalid={Boolean(passwordError)}
                placeholder={mode === 'signin' ? 'Your password' : 'At least 8 characters'}
                className={`${fieldClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-indigo-100 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {passwordError && <p className="mt-1.5 text-sm text-rose-300">{passwordError}</p>}
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" isLoading={busy === 'password'} disabled={busy !== null}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-sm text-indigo-200" role="separator">
          <span className="h-px flex-1 bg-white/15" />
          or
          <span className="h-px flex-1 bg-white/15" />
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={google}
          isLoading={busy === 'google'}
          disabled={busy !== null}
          leftIcon={<GoogleLogo />}
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-base text-indigo-100">
          {mode === 'signin' ? 'New to InsightFlow?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            className="rounded font-semibold text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};
