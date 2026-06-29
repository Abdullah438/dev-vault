'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Key, 
  Plus, 
  Eye, 
  Copy, 
  Check, 
  Trash2, 
  LogOut, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  EyeOff, 
  Loader2,
  Lock,
  User
} from 'lucide-react';

interface SecretMetadata {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

interface DashboardClientProps {
  user: any;
  initialSecrets: SecretMetadata[];
}

export default function DashboardClient({ user, initialSecrets }: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  
  // State
  const [secrets, setSecrets] = useState<SecretMetadata[]>(initialSecrets);
  const [newName, setNewName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Modals / Overlays
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [newlyGeneratedName, setNewlyGeneratedName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState('');
  
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Logout Handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Generate Secret Handler
  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsGenerating(true);
      setErrorMsg(null);
      
      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate key.');

      // Add new secret to the list
      const newSecretItem: SecretMetadata = {
        id: data.id,
        name: data.name,
        prefix: data.prefix,
        created_at: data.created_at,
        last_used_at: null,
      };
      
      setSecrets([newSecretItem, ...secrets]);
      setNewlyGeneratedKey(data.plaintext);
      setNewlyGeneratedName(data.name);
      setNewName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch and Reveal Secret
  const handleRevealSecret = async (id: string, name: string) => {
    try {
      setLoadingSecretId(id);
      setErrorMsg(null);

      const res = await fetch(`/api/secrets/${id}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to retrieve secret.');

      setRevealedKey(data.plaintext);
      setRevealedName(name);
      
      // Update the local listing's last_used_at timestamp to match DB audit update
      setSecrets(secrets.map(sec => 
        sec.id === id ? { ...sec, last_used_at: new Date().toISOString() } : sec
      ));
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not decrypt the secret.');
    } finally {
      setLoadingSecretId(null);
    }
  };

  // Direct Fetch & Copy to Clipboard
  const handleFetchAndCopy = async (id: string) => {
    try {
      setLoadingSecretId(id);
      const res = await fetch(`/api/secrets/${id}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch.');

      await navigator.clipboard.writeText(data.plaintext);
      setCopiedId(id);
      
      // Reset copied indicator after 2s
      setTimeout(() => setCopiedId(null), 2000);
      
      // Update local last_used_at timestamp
      setSecrets(secrets.map(sec => 
        sec.id === id ? { ...sec, last_used_at: new Date().toISOString() } : sec
      ));
    } catch (err) {
      console.error('Copy failed:', err);
    } finally {
      setLoadingSecretId(null);
    }
  };

  // Delete Secret Handler
  const handleDeleteSecret = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/secrets/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete key.');

      // Remove from state
      setSecrets(secrets.filter(sec => sec.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not revoke the secret.');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string, idStr: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(idStr);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container" style={{ minHeight: '90vh', position: 'relative' }}>
      
      {/* Header Panel */}
      <header className="glass-panel" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem 2rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'var(--accent-gradient)',
            padding: '0.5rem',
            borderRadius: '10px',
            boxShadow: '0 0 12px rgba(6, 182, 212, 0.3)'
          }}>
            <Key size={22} color="#ffffff" style={{ transform: 'rotate(-45deg)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Dev<span className="text-gradient">Vault</span></h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Secure Encryption Hub</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <User size={16} />
            <span>{user?.email}</span>
          </div>
          <button 
            onClick={handleLogout} 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>
        
        {/* Left Side: Create Secret Panel */}
        <section className="glass-panel">
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Generate New API Key</h2>
          <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Generate a secure, random developer key. The key will be encrypted on the server using AES-256-GCM.
          </p>

          {errorMsg && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'var(--danger-glow)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <ShieldAlert size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateSecret}>
            <div className="form-group">
              <label htmlFor="key-name" className="form-label">Key Name / Description</label>
              <input
                id="key-name"
                type="text"
                placeholder="e.g., Stripe Gateway Webhook, Production App Client"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="form-input"
                maxLength={80}
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={isGenerating || !newName.trim()} 
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem' }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Generate Encrypted Secret</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right Side: Vault Status Details */}
        <section className="glass-panel" style={{
          background: 'linear-gradient(135deg, rgba(15, 22, 40, 0.65) 0%, rgba(30, 20, 50, 0.3) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100%',
          padding: '2.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{
              background: 'rgba(6, 182, 212, 0.1)',
              padding: '0.75rem',
              borderRadius: '12px',
              color: 'var(--accent-cyan)'
            }}>
              <Lock size={28} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Active Vault Protection</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Your keys are encrypted using a 256-bit Advanced Encryption Standard (AES) key in Galois/Counter Mode.
              </p>
            </div>
          </div>

          <div style={{
            borderLeft: '2px solid var(--accent-cyan)',
            paddingLeft: '1rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}>
            <p style={{ marginBottom: '0.5rem' }}>
              • <strong>Server-Side Encryption:</strong> Keys are never processed or decrypted inside database tables. The raw values are unrecoverable without the environment-configured Master Key.
            </p>
            <p>
              • <strong>Granular Audit Trail:</strong> Each decryption query updates a `last_used_at` log, helping track security access.
            </p>
          </div>
        </section>

      </div>

      {/* Bottom Row: Table List of Active Keys */}
      <main style={{ marginTop: '2.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Active Keys & Secrets</span>
            <span style={{ 
              fontSize: '0.8rem', 
              background: 'rgba(255,255,255,0.06)', 
              padding: '0.2rem 0.6rem', 
              borderRadius: '20px',
              color: 'var(--text-secondary)'
            }}>
              {secrets.length} total
            </span>
          </h2>

          {secrets.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 1rem', 
              color: 'var(--text-muted)', 
              border: '1px dashed var(--glass-border)',
              borderRadius: 'var(--border-radius-sm)'
            }}>
              <Key size={48} style={{ opacity: 0.3, marginBottom: '1rem', transform: 'rotate(-45deg)' }} />
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>No keys created yet.</p>
              <p style={{ fontSize: '0.85rem' }}>Use the generator above to create your first encrypted API secret.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Identifier Prefix</th>
                    <th>Created At</th>
                    <th>Last Revealed</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {secrets.map((sec) => (
                    <tr key={sec.id}>
                      <td style={{ fontWeight: 600 }}>{sec.name}</td>
                      <td>
                        <span className="badge badge-code">{sec.prefix}...</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {formatDate(sec.created_at)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          {sec.last_used_at ? formatDate(sec.last_used_at) : 'Never'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                          
                          {/* Reveal Button */}
                          <button
                            onClick={() => handleRevealSecret(sec.id, sec.name)}
                            disabled={loadingSecretId !== null}
                            className="btn btn-secondary"
                            title="Decrypt & Reveal Secret"
                            style={{ padding: '0.4rem 0.6rem' }}
                          >
                            {loadingSecretId === sec.id ? (
                              <Loader2 size={15} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Eye size={15} />
                            )}
                          </button>

                          {/* Quick Copy Button */}
                          <button
                            onClick={() => handleFetchAndCopy(sec.id)}
                            disabled={loadingSecretId !== null}
                            className="btn btn-secondary"
                            title="Fetch plaintext & Copy"
                            style={{ 
                              padding: '0.4rem 0.6rem',
                              borderColor: copiedId === sec.id ? 'var(--success)' : 'var(--glass-border)',
                              background: copiedId === sec.id ? 'var(--success-glow)' : 'rgba(255, 255, 255, 0.05)',
                              color: copiedId === sec.id ? 'var(--success)' : 'inherit'
                            }}
                          >
                            {loadingSecretId === sec.id ? (
                              <Loader2 size={15} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                            ) : copiedId === sec.id ? (
                              <Check size={15} />
                            ) : (
                              <Copy size={15} />
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setDeleteTarget(sec)}
                            className="btn btn-danger"
                            title="Delete Key"
                            style={{ padding: '0.4rem 0.6rem' }}
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}

      {/* 1. Newly Generated Key Modal (Show Once Notice) */}
      {newlyGeneratedKey && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock style={{ color: 'var(--success)' }} />
              <span>Key Generated Successfully</span>
            </h3>
            
            <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Here is your secure API key for <strong>{newlyGeneratedName}</strong>. You can copy it now, or retrieve it from DevVault later.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              color: 'var(--accent-cyan)',
              wordBreak: 'break-all',
              gap: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <span>{newlyGeneratedKey}</span>
              <button
                onClick={() => copyToClipboard(newlyGeneratedKey, 'gen-modal')}
                className="btn btn-secondary"
                style={{ 
                  padding: '0.4rem', 
                  flexShrink: 0,
                  borderColor: copiedId === 'gen-modal' ? 'var(--success)' : 'var(--glass-border)',
                  background: copiedId === 'gen-modal' ? 'var(--success-glow)' : 'transparent',
                  color: copiedId === 'gen-modal' ? 'var(--success)' : 'inherit'
                }}
              >
                {copiedId === 'gen-modal' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <button
              onClick={() => {
                setNewlyGeneratedKey(null);
                setNewlyGeneratedName('');
              }}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Close and Open Dashboard
            </button>
          </div>
        </div>
      )}

      {/* 2. Revealed Secret Modal */}
      {revealedKey && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderTop: '4px solid var(--accent-purple)' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye style={{ color: 'var(--accent-purple)' }} />
              <span>Decrypted Secret Value</span>
            </h3>
            
            <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Plaintext secret decrypted for key: <strong>{revealedName}</strong>. Keep this window private.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1rem',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--border-radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              color: 'var(--accent-purple)',
              wordBreak: 'break-all',
              gap: '0.5rem',
              marginBottom: '1.5rem'
            }}>
              <span>{revealedKey}</span>
              <button
                onClick={() => copyToClipboard(revealedKey, 'rev-modal')}
                className="btn btn-secondary"
                style={{ 
                  padding: '0.4rem', 
                  flexShrink: 0,
                  borderColor: copiedId === 'rev-modal' ? 'var(--success)' : 'var(--glass-border)',
                  background: copiedId === 'rev-modal' ? 'var(--success-glow)' : 'transparent',
                  color: copiedId === 'rev-modal' ? 'var(--success)' : 'inherit'
                }}
              >
                {copiedId === 'rev-modal' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <button
              onClick={() => {
                setRevealedKey(null);
                setRevealedName('');
              }}
              className="btn btn-secondary"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)' }}
            >
              Hide Secret
            </button>
          </div>
        </div>
      )}

      {/* 3. Delete / Revocation Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderTop: '4px solid var(--danger)' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert style={{ color: 'var(--danger)' }} />
              <span>Revoke API Key?</span>
            </h3>
            
            <p style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Are you sure you want to permanently revoke and delete the key <strong>{deleteTarget.name}</strong>? 
              Any clients or applications using this secret will be immediately unauthorized. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleDeleteSecret}
                disabled={isDeleting}
                className="btn btn-danger"
                style={{ flex: 1, padding: '0.75rem' }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Revoking...</span>
                  </>
                ) : (
                  <span>Revoke Key</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spin Animation Definition */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>

    </div>
  );
}
