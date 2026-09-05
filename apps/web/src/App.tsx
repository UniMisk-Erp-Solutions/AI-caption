import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spinner } from './components/ui';
import { hasSupabase } from './lib/env';
import { getSession, supabase } from './lib/supabase';
import { AuthPage } from './features/auth/AuthPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DemoPage } from './features/demo/DemoPage';
import { EditorPage } from './features/editor/EditorPage';
import { UploadPage } from './features/upload/UploadPage';

/**
 * Routing and the auth gate.
 *
 * In local mode there is no session to check, so `RequireAuth` is a pass-through
 * and the whole app is usable immediately. That is deliberate: the fastest way
 * to lose someone evaluating a tool is a sign-up wall before they have seen it
 * do anything.
 */

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={<AuthPage />} />
        {/* Public, so the tool can be evaluated before signing up. */}
        <Route path="/gallery" element={<DemoPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/new"
          element={
            <RequireAuth>
              <UploadPage />
            </RequireAuth>
          }
        />
        <Route
          path="/project/:projectId"
          element={
            <RequireAuth>
              <EditorPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>(
    hasSupabase ? 'checking' : 'in',
  );

  useEffect(() => {
    if (!hasSupabase) return;

    let cancelled = false;
    void getSession().then((session) => {
      if (!cancelled) setStatus(session ? 'in' : 'out');
    });

    const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'in' : 'out');
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-ink-400">
        <Spinner /> Checking your session…
      </div>
    );
  }

  if (status === 'out') return <Navigate to="/signin" state={{ from: location }} replace />;

  return <>{children}</>;
}
