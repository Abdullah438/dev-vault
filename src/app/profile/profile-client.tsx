'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  canChangePassword,
  formatProviderLabel,
  getAuthProviders,
  getProfileName,
  type ProfileMetadata,
} from '@/lib/user-profile';
import { Key, ArrowLeft, AlertTriangle, ShieldCheck, User, Mail, Shield } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileClientProps {
  user: SupabaseUser;
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(getProfileName(user));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const providers = getAuthProviders(user);
  const showPasswordLink = canChangePassword(user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fullName.trim();

    if (!trimmed) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const data: ProfileMetadata = { full_name: trimmed };
      const { error: updateError } = await supabase.auth.updateUser({ data });

      if (updateError) throw updateError;

      setSuccess(true);
      router.refresh();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-blob login-blob-top" />
      <div className="login-blob login-blob-bottom" />

      <div className="glass-panel login-card profile-card">
        <div className="profile-top-bar">
          <Link href="/" className="profile-back-link">
            <ArrowLeft size={16} />
            Back to vault
          </Link>
        </div>

        <div className="profile-brand">
          <div className="login-logo">
            <User size={26} color="#ffffff" />
          </div>

          <h1 className="login-title">Your profile</h1>
          <p className="login-subtitle">
            Set how your name appears in DevVault.
          </p>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error">
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert auth-alert-success">
            <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Profile updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setSuccess(false);
              }}
              required
              className="form-input"
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="profile-email">Email address</label>
            <div className="profile-readonly-field">
              <Mail size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
              <span id="profile-email">{user.email}</span>
            </div>
            <p className="profile-field-hint">Email cannot be changed.</p>
          </div>

          <div className="auth-field">
            <label>Sign-in method</label>
            <div className="profile-readonly-field">
              <Shield size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
              <span>{providers.map(formatProviderLabel).join(', ')}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: '0.25rem', width: '100%' }}
          >
            {loading ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        {showPasswordLink && (
          <div className="profile-secondary-action">
            <Link href="/update-password" className="auth-link" style={{ fontSize: '0.875rem' }}>
              Change password
            </Link>
          </div>
        )}

        <div className="auth-footer">
          <Key size={14} style={{ flexShrink: 0, transform: 'rotate(-45deg)' }} />
          <span>DevVault account settings</span>
        </div>
      </div>
    </main>
  );
}
