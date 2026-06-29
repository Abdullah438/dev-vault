'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Key, AlertTriangle, ShieldCheck } from 'lucide-react';

function UpdatePasswordContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '1.5rem',
      position: 'relative'
    }}>
      {/* Background Decorative Blur Blobs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '25%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)',
        zIndex: 0,
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '25%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)',
        zIndex: 0,
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }} />

      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        padding: '3rem 2.25rem',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'var(--accent-gradient)',
          marginBottom: '1.5rem',
          boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
        }}>
          <Key size={32} color="#ffffff" style={{ transform: 'rotate(-45deg)' }} />
        </div>

        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Update Password
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2.5rem' }}>
          Please enter your new password below.
        </p>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'var(--danger-glow)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            borderRadius: 'var(--border-radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.875rem',
            textAlign: 'left',
            marginBottom: '1.5rem'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem',
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 'var(--border-radius-sm)',
            color: 'var(--success)'
          }}>
            <ShieldCheck size={48} />
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Password Updated!</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>You will be redirected to the login page momentarily...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>New Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="form-input" placeholder="••••••••" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="form-input" placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <UpdatePasswordContent />
    </Suspense>
  );
}
