'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Key, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'reset';

function LoginContent() {
  const [loading, setLoading] = useState<'google' | 'github' | 'email' | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setAuthError(prev => prev ? prev : 'Authentication failed. Please try again.');
    }
  }, [searchParams]);

  const clearMessages = () => {
    setAuthError(null);
    setAuthSuccess(null);
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    clearMessages();
    if (next !== 'signup') setFullName('');
  };

  const handleLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(provider);
      clearMessages();

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : `Could not start ${provider} authentication flow.`;
      setAuthError(message);
      setLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading('email');
    clearMessages();

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          setAuthError('Please enter your name.');
          setLoading(null);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        setAuthSuccess('Success! Please check your email for a confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setAuthError(message);
    } finally {
      setLoading(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setAuthError('Please enter your email address.');
      return;
    }
    setLoading('email');
    clearMessages();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) throw error;
      setAuthSuccess('If an account exists, a password reset link has been sent to your email.');
      switchMode('login');
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to send reset email.';
      setAuthError(message);
    } finally {
      setLoading(null);
    }
  };

  const isResetting = mode === 'reset';
  const isSignUp = mode === 'signup';

  return (
    <main className="login-page">
      <div className="login-blob login-blob-top" />
      <div className="login-blob login-blob-bottom" />

      <div className="glass-panel login-card">
        <div className="login-logo">
          <Key size={28} color="#ffffff" style={{ transform: 'rotate(-45deg)' }} />
        </div>

        <h1 className="login-title">
          Dev<span className="text-gradient">Vault</span>
        </h1>
        <p className="login-subtitle">
          {isResetting
            ? 'Enter your email and we\u2019ll send you a reset link.'
            : 'Generate and manage API keys, passwords, and secrets in one secure vault.'}
        </p>

        {!isResetting && (
          <div className="auth-privacy-note">
            <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong>Your secrets stay yours.</strong>{' '}
              Everything is encrypted in your browser before it is saved. Only your master passphrase can unlock the vault — we never receive it and cannot read your data.
            </div>
          </div>
        )}

        {authError && (
          <div className="auth-alert auth-alert-error">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="auth-alert auth-alert-success">
            <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{authSuccess}</span>
          </div>
        )}

        {isResetting ? (
          <>
            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="auth-field">
                <label htmlFor="reset-email">Email address</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <button
                type="submit"
                disabled={loading !== null}
                className="btn btn-primary"
                style={{ marginTop: '0.25rem', width: '100%' }}
              >
                {loading === 'email' ? 'Please wait\u2026' : 'Send reset link'}
              </button>
            </form>
            <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <button type="button" onClick={() => switchMode('login')} className="auth-link" style={{ fontSize: '0.85rem' }}>
                Back to log in
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`auth-tab${mode === 'login' ? ' active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Sign up
              </button>
            </div>

            <div className="auth-oauth-stack">
              <button
                onClick={() => handleLogin('github')}
                disabled={loading !== null}
                className="btn btn-secondary auth-oauth-btn"
              >
                <svg style={{ width: 20, height: 20, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                <span>{loading === 'github' ? 'Connecting\u2026' : 'Continue with GitHub'}</span>
              </button>

              <button
                onClick={() => handleLogin('google')}
                disabled={loading !== null}
                className="btn btn-secondary auth-oauth-btn"
                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
              >
                <svg style={{ width: 20, height: 20, flexShrink: 0 }} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>{loading === 'google' ? 'Connecting\u2026' : 'Continue with Google'}</span>
              </button>
            </div>

            <div className="auth-divider">
              <div className="auth-divider-line" />
              <span className="auth-divider-text">or</span>
              <div className="auth-divider-line" />
            </div>

            <form onSubmit={handleEmailAuth} className="auth-form">
              {isSignUp && (
                <div className="auth-field">
                  <label htmlFor="full-name">Full name</label>
                  <input
                    id="full-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="form-input"
                    placeholder="Jane Doe"
                    autoComplete="name"
                  />
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="form-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <div className="auth-field-header">
                  <label htmlFor="auth-password">Password</label>
                  {!isSignUp && (
                    <button type="button" onClick={() => switchMode('reset')} className="auth-link">
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input"
                  placeholder="••••••••"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={loading !== null}
                className="btn btn-primary"
                style={{ marginTop: '0.25rem', width: '100%' }}
              >
                {loading === 'email' ? 'Please wait\u2026' : isSignUp ? 'Create account' : 'Log in'}
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">
          <Lock size={14} style={{ flexShrink: 0 }} />
          <span>Encrypted before it leaves your device</span>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
