import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Field, Spinner } from '../../components/ui';
import { hasSupabase } from '../../lib/env';
import { signIn, signInWithGoogle, signUp } from '../../lib/supabase';

/**
 * Sign in.
 *
 * Only reachable when Supabase is configured - in local mode there is nothing
 * to sign into, so the route redirects straight to the dashboard.
 */

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!hasSupabase) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        setSent(true);
      } else {
        await signIn(email, password);
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="font-display text-4xl leading-none text-ink-100">Kinetic</h1>
      <p className="mt-2 text-sm text-ink-400">
        Turn speech and lyrics into designed kinetic typography.
      </p>

      {sent ? (
        <p className="mt-8 rounded border border-ink-800 bg-ink-900 px-4 py-3 text-sm leading-relaxed text-ink-300">
          Check your inbox to confirm <strong className="text-ink-100">{email}</strong>,
          then sign in.
        </p>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={submit}>
          <Field label="Email">
            <input
              className="field"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Password">
            <input
              className="field"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && (
            <p className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy && <Spinner />}
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <button
            type="button"
            className="btn-outline w-full py-2.5"
            onClick={() => void signInWithGoogle()}
          >
            Continue with Google
          </button>

          <button
            type="button"
            className="w-full text-center text-[11px] text-ink-500 hover:text-ink-300"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            {mode === 'signin'
              ? 'No account yet? Create one'
              : 'Already have an account? Sign in'}
          </button>
        </form>
      )}

      <p className="mt-10 text-[11px] leading-relaxed text-ink-600">
        During the free beta, audio is processed by Google's free Gemini tier,
        which may use requests to improve their products. Please do not upload
        confidential or sensitive video.
      </p>
    </div>
  );
}
