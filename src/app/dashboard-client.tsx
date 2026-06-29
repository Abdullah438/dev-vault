'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useVaultSession } from '@/components/vault-session-provider';
import { getDisplayName, hasProfileName } from '@/lib/user-profile';
import { 
  deriveSaltFromUserId, 
  deriveMasterKey, 
  encryptClient, 
  decryptClient, 
  generateClientSecretValue,
  generateAuthSecretValue,
  generateCustomPassword
} from '@/lib/client-crypto';
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
  Loader2, 
  Lock, 
  Unlock, 
  User, 
  ShieldCheck,
  Pencil,
  EyeOff,
  FolderOpen,
  CreditCard,
  FileText,
  Terminal,
  Bitcoin,
  Landmark,
  FileBadge,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

function GitHubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

const GENERATABLE_CATEGORIES = ['API Key', 'Auth Secret', 'Password'] as const;
const PASTE_SECRET_CATEGORIES = ['API Key', 'Auth Secret', 'Password', 'GitHub Token'] as const;

function renderPasswordGeneratorOptions(
  pwdLength: number,
  setPwdLength: (v: number) => void,
  pwdUpper: boolean,
  setPwdUpper: (v: boolean) => void,
  pwdLower: boolean,
  setPwdLower: (v: boolean) => void,
  pwdNumbers: boolean,
  setPwdNumbers: (v: boolean) => void,
  pwdSymbols: boolean,
  setPwdSymbols: (v: boolean) => void,
) {
  return (
    <div className="generator-options">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Length: {pwdLength}</span>
        <input type="range" min="8" max="64" value={pwdLength} onChange={(e) => setPwdLength(parseInt(e.target.value))} style={{ width: '120px' }} />
      </div>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><input type="checkbox" checked={pwdUpper} onChange={(e) => setPwdUpper(e.target.checked)} /> A-Z</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><input type="checkbox" checked={pwdLower} onChange={(e) => setPwdLower(e.target.checked)} /> a-z</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><input type="checkbox" checked={pwdNumbers} onChange={(e) => setPwdNumbers(e.target.checked)} /> 0-9</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><input type="checkbox" checked={pwdSymbols} onChange={(e) => setPwdSymbols(e.target.checked)} /> !@#</label>
      </div>
    </div>
  );
}

function renderPrefixOption(apiKeyPrefix: string, setApiKeyPrefix: (v: string) => void) {
  return (
    <div className="generator-options" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Prefix:</span>
      <input type="text" value={apiKeyPrefix} onChange={(e) => setApiKeyPrefix(e.target.value)} className="form-input" style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.8rem' }} />
    </div>
  );
}

interface SecretMetadata {
  id: string;
  name: string;
  prefix: string;
  category: string;
  created_at: string;
  last_used_at: string | null;
}

interface DashboardClientProps {
  user: any;
  initialSecrets: SecretMetadata[];
  initialTotal: number;
  initialVaultTotal: number;
  pageSize: number;
}

type UnlockMeta = {
  total: number;
  verificationId: string | null;
  migrationSecretId: string | null;
};

export default function DashboardClient({
  user,
  initialSecrets,
  initialTotal,
  initialVaultTotal,
  pageSize,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { masterKey, setMasterKey, lockVault } = useVaultSession();
  
  // Vault secrets metadata state (current page from server)
  const [secrets, setSecrets] = useState<SecretMetadata[]>(initialSecrets);
  const [totalSecrets, setTotalSecrets] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil(initialTotal / pageSize)));
  const [unlockMeta, setUnlockMeta] = useState<UnlockMeta>({
    total: initialVaultTotal,
    verificationId: null,
    migrationSecretId: null,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoadingSecrets, setIsLoadingSecrets] = useState(false);
  
  // Zero-Knowledge Master Key State
  const [masterPassphrase, setMasterPassphrase] = useState('');
  const [showLockscreenPassphrase, setShowLockscreenPassphrase] = useState(false);
  const [isDerivingKey, setIsDerivingKey] = useState(false);
  const [lockscreenError, setLockscreenError] = useState<string | null>(null);
  
  // "Add Secret" Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('API Key');
  const [customSecretValue, setCustomSecretValue] = useState('');

  // Generator Options
  const [pwdLength, setPwdLength] = useState(24);
  const [pwdUpper, setPwdUpper] = useState(true);
  const [pwdLower, setPwdLower] = useState(true);
  const [pwdNumbers, setPwdNumbers] = useState(true);
  const [pwdSymbols, setPwdSymbols] = useState(true);
  const [apiKeyPrefix, setApiKeyPrefix] = useState('sec_');
  
  // Credit Card Creation Fields
  const [ccCardholder, setCcCardholder] = useState('');
  const [ccNumber, setCcNumber] = useState('');
  const [ccExpiry, setCcExpiry] = useState('');
  const [ccCvv, setCcCvv] = useState('');

  // Bank Account Creation Fields
  const [baHolder, setBaHolder] = useState('');
  const [baBankName, setBaBankName] = useState('');
  const [baNumber, setBaNumber] = useState('');
  const [baRouting, setBaRouting] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // "Edit Secret" Modal States
  const [editingSecret, setEditingSecret] = useState<SecretMetadata | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSecretValue, setEditSecretValue] = useState('');
  const [showEditPlaintext, setShowEditPlaintext] = useState(false);
  const [showNewPlaintext, setShowNewPlaintext] = useState(false);
  
  // Credit Card Edit Fields
  const [editCcCardholder, setEditCcCardholder] = useState('');
  const [editCcNumber, setEditCcNumber] = useState('');
  const [editCcExpiry, setEditCcExpiry] = useState('');
  const [editCcCvv, setEditCcCvv] = useState('');

  // Bank Account Edit Fields
  const [editBaHolder, setEditBaHolder] = useState('');
  const [editBaBankName, setEditBaBankName] = useState('');
  const [editBaNumber, setEditBaNumber] = useState('');
  const [editBaRouting, setEditBaRouting] = useState('');

  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  
  // Modals / Overlays
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [newlyGeneratedName, setNewlyGeneratedName] = useState('');
  
  // Revealed Value Modal States
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealedName, setRevealedName] = useState('');
  const [revealedCategory, setRevealedCategory] = useState('');
  
  const [loadingSecretId, setLoadingSecretId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SecretMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const showProfileBanner = !hasProfileName(user) && !getDisplayName(user);

  const autogenerateSecret = (category: string, target: 'new' | 'edit') => {
    const value = category === 'Password'
      ? generateCustomPassword(pwdLength, { upper: pwdUpper, lower: pwdLower, numbers: pwdNumbers, symbols: pwdSymbols })
      : category === 'Auth Secret'
        ? generateAuthSecretValue()
        : generateClientSecretValue(32, apiKeyPrefix);

    if (target === 'new') {
      setCustomSecretValue(value);
      setShowNewPlaintext(true);
    } else {
      setEditSecretValue(value);
      setShowEditPlaintext(true);
    }
  };

  const handleCategorySelect = (category: string) => {
    setNewCategory(category);
    setErrorMsg(null);
    setCustomSecretValue('');
    if (category === 'API Key') setApiKeyPrefix('sec_');
  };

  const refreshUnlockMeta = async () => {
    const res = await fetch('/api/secrets/unlock-meta');
    const data = await res.json();
    if (res.ok) {
      setUnlockMeta({
        total: data.total,
        verificationId: data.verificationId,
        migrationSecretId: data.migrationSecretId,
      });
    }
  };

  const fetchSecrets = async (page: number, search: string) => {
    setIsLoadingSecrets(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) params.set('search', search);

      const res = await fetch(`/api/secrets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load secrets.');

      setSecrets(data.data);
      setTotalSecrets(data.total);
      setTotalPages(data.totalPages);
      setCurrentPage(data.page);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to load secrets.';
      setErrorMsg(message);
    } finally {
      setIsLoadingSecrets(false);
    }
  };

  useEffect(() => {
    refreshUnlockMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!masterKey) return;
    fetchSecrets(currentPage, debouncedSearch);
  }, [masterKey, currentPage, debouncedSearch]);

  // Logout Handler
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      lockVault();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  const renderLogoutModal = () => {
    if (!showLogoutConfirm) return null;
    return (
      <div className="modal-overlay" style={{ zIndex: 100 }}>
        <div className="modal-content" style={{ maxWidth: '400px', borderTop: '4px solid var(--warning)' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 0 14px rgba(245, 158, 11, 0.2)' }}>
                <LogOut size={18} color="var(--warning)" />
              </div>
              <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Sign Out</h3>
            </div>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to sign out? You will need to authenticate and enter your master passphrase again to access your vault.
            </p>
          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setShowLogoutConfirm(false)} disabled={isLoggingOut} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button onClick={handleLogout} disabled={isLoggingOut} className="btn btn-primary" style={{ flex: 1, borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
              {isLoggingOut ? <><Loader2 size={16} className="animate-spin" /><span>Signing out...</span></> : <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Derive local Master Key from user passphrase
  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassphrase.trim()) return;

    try {
      setIsDerivingKey(true);
      setLockscreenError(null);
      
      // Derive salt consistently from the user's UUID
      const salt = await deriveSaltFromUserId(user.id);
      
      // PBKDF2 100,000 iterations to derive AES-256-GCM key
      const key = await deriveMasterKey(masterPassphrase, salt);

      const metaRes = await fetch('/api/secrets/unlock-meta');
      const meta = await metaRes.json();
      if (!metaRes.ok) throw new Error(meta.error || 'Failed to load vault metadata.');

      setUnlockMeta({
        total: meta.total,
        verificationId: meta.verificationId,
        migrationSecretId: meta.migrationSecretId,
      });

      if (meta.verificationId) {
        const res = await fetch(`/api/secrets/${meta.verificationId}`);
        const data = await res.json();
        if (!res.ok) throw new Error('Verification request failed.');
        
        try {
          const decrypted = await decryptClient(data.encrypted_secret, data.iv, key);
          if (decrypted !== 'devvault:verified') {
            throw new Error('Verification payload mismatch');
          }
        } catch {
          setLockscreenError('Incorrect Master Passphrase. Please try again.');
          return;
        }
      } else if (meta.migrationSecretId) {
        const res = await fetch(`/api/secrets/${meta.migrationSecretId}`);
        const data = await res.json();
        if (!res.ok) throw new Error('Migration verification request failed.');
        
        try {
          await decryptClient(data.encrypted_secret, data.iv, key);
        } catch {
          setLockscreenError('Incorrect Master Passphrase. Please try again.');
          return;
        }
        
        await createVerificationToken(key);
        await refreshUnlockMeta();
      } else {
        await createVerificationToken(key);
        await refreshUnlockMeta();
      }
      
      setMasterKey(key);
    } catch (err: any) {
      console.error(err);
      setLockscreenError('An error occurred during vault verification.');
    } finally {
      setIsDerivingKey(false);
    }
  };

  // Create internal verification token
  const createVerificationToken = async (derivedKey: CryptoKey) => {
    try {
      const { ciphertext, iv } = await encryptClient('devvault:verified', derivedKey);
      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '__devvault_verification__',
          category: 'System',
          encrypted_secret: ciphertext,
          iv: iv,
          prefix: 'ver_'
        })
      });
      const data = await res.json();
      if (res.ok) {
        await refreshUnlockMeta();
      }
    } catch (err) {
      console.error('Failed to create verification token:', err);
    }
  };

  // Lock Vault
  const handleLockVault = () => {
    lockVault();
    setMasterPassphrase('');
    setNewlyGeneratedKey(null);
    setRevealedKey(null);
    setErrorMsg(null);
  };

  // Generate / Save Secret Handler (Client-Side Encryption)
  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !masterKey) return;

    // Validate based on category selection
    if (newCategory === 'Credit Card' && (!ccNumber.trim() || !ccCardholder.trim())) {
      setErrorMsg('Card Number and Cardholder are required.');
      return;
    }
    if (newCategory === 'Bank Account' && (!baNumber.trim() || !baHolder.trim() || !baBankName.trim())) {
      setErrorMsg('Account Number, Holder Name, and Bank Name are required.');
      return;
    }
    if ([...PASTE_SECRET_CATEGORIES, 'Secure Note', 'SSH Key', 'Crypto Seed Phrase', 'Software License'].includes(newCategory) && !customSecretValue.trim()) {
      setErrorMsg('Secret value cannot be empty.');
      return;
    }

    if (newCategory === 'GitHub Token' && !/^(gh[pousr]_|github_pat_)/.test(customSecretValue.trim())) {
      setErrorMsg('Enter a valid GitHub token (ghp_, github_pat_, gho_, etc.).');
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMsg(null);
      
      // 1. Pack the plaintext secret value
      let plaintextSecret = '';
      if (newCategory === 'Credit Card') {
        plaintextSecret = JSON.stringify({
          cardholder: ccCardholder.trim(),
          number: ccNumber.trim(),
          expiry: ccExpiry.trim(),
          cvv: ccCvv.trim()
        });
      } else if (newCategory === 'Bank Account') {
        plaintextSecret = JSON.stringify({
          holder: baHolder.trim(),
          bankName: baBankName.trim(),
          accountNumber: baNumber.trim(),
          routingNumber: baRouting.trim()
        });
      } else {
        plaintextSecret = customSecretValue;
      }
        
      // Derive a safe identifier prefix (to prevent leakage of custom passwords)
      let prefix = 'usr_';
      if (newCategory === 'Credit Card') {
        prefix = 'crd_' + ccNumber.trim().slice(-4); // Last 4 digits of card
      } else if (newCategory === 'Bank Account') {
        prefix = 'bnk_' + baNumber.trim().slice(-4); // Last 4 digits of bank account
      } else if (newCategory === 'API Key') {
        prefix = plaintextSecret.length >= 8 ? plaintextSecret.substring(0, 8) : 'usr_api_';
      } else if (newCategory === 'Auth Secret') {
        prefix = plaintextSecret.length >= 8 ? plaintextSecret.substring(0, 8) : 'auth_sec';
      } else if (newCategory === 'GitHub Token') {
        prefix = plaintextSecret.trim().length >= 8 ? plaintextSecret.trim().substring(0, 8) : 'ghp_';
      } else {
        prefix = 'usr_' + Math.random().toString(36).substring(2, 6);
      }
      
      // 2. Encrypt locally using Master Key
      const { ciphertext, iv } = await encryptClient(plaintextSecret, masterKey);
      
      // 3. Post only the encrypted payload to the server
      const res = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newName.trim(),
          encrypted_secret: ciphertext,
          iv: iv,
          prefix: prefix,
          category: newCategory
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save encrypted key.');

      if (['API Key', 'Password'].includes(newCategory)) {
        setNewlyGeneratedKey(plaintextSecret);
        setNewlyGeneratedName(data.name);
      }
      
      setCurrentPage(1);
      await fetchSecrets(1, debouncedSearch);
      await refreshUnlockMeta();
      
      // Reset states & Close Modal
      setNewName('');
      setCustomSecretValue('');
      setNewCategory('API Key');
      
      setCcCardholder('');
      setCcNumber('');
      setCcExpiry('');
      setCcCvv('');

      setBaHolder('');
      setBaBankName('');
      setBaNumber('');
      setBaRouting('');

      setIsAddModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch and decrypt secret to open the Edit Modal
  const handleStartEditSecret = async (sec: SecretMetadata) => {
    if (!masterKey) return;
    try {
      setLoadingSecretId(sec.id);
      setErrorMsg(null);
      setEditError(null);

      // Fetch encrypted secret payload
      const res = await fetch(`/api/secrets/${sec.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch.');

      // Decrypt locally
      const plaintext = await decryptClient(data.encrypted_secret, data.iv, masterKey);

      setEditingSecret(sec);
      setEditName(sec.name);
      setEditCategory(sec.category);
      setShowEditPlaintext(false);

      // Prefill fields based on category
      if (sec.category === 'Credit Card') {
        try {
          const parsed = JSON.parse(plaintext);
          setEditCcCardholder(parsed.cardholder || '');
          setEditCcNumber(parsed.number || '');
          setEditCcExpiry(parsed.expiry || '');
          setEditCcCvv(parsed.cvv || '');
        } catch {
          setEditCcNumber(plaintext);
        }
      } else if (sec.category === 'Bank Account') {
        try {
          const parsed = JSON.parse(plaintext);
          setEditBaHolder(parsed.holder || '');
          setEditBaBankName(parsed.bankName || '');
          setEditBaNumber(parsed.accountNumber || '');
          setEditBaRouting(parsed.routingNumber || '');
        } catch {
          setEditBaNumber(plaintext);
        }
      } else {
        setEditSecretValue(plaintext);
      }

    } catch (err: any) {
      console.error('Decryption fail on edit start:', err);
      setErrorMsg('Failed to decrypt. Passphrase may be invalid.');
    } finally {
      setLoadingSecretId(null);
    }
  };

  // Save Edited Secret (Client-Side Encryption)
  const handleSaveEditSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSecret || !editName.trim() || !masterKey) return;

    try {
      setIsSavingEdit(true);
      setEditError(null);

      // Pack edited value
      let plaintextSecret = '';
      if (editCategory === 'Credit Card') {
        plaintextSecret = JSON.stringify({
          cardholder: editCcCardholder.trim(),
          number: editCcNumber.trim(),
          expiry: editCcExpiry.trim(),
          cvv: editCcCvv.trim()
        });
      } else if (editCategory === 'Bank Account') {
        plaintextSecret = JSON.stringify({
          holder: editBaHolder.trim(),
          bankName: editBaBankName.trim(),
          accountNumber: editBaNumber.trim(),
          routingNumber: editBaRouting.trim()
        });
      } else {
        plaintextSecret = editSecretValue;
      }

      if (editCategory === 'GitHub Token' && !/^(gh[pousr]_|github_pat_)/.test(plaintextSecret.trim())) {
        setEditError('Enter a valid GitHub token (ghp_, github_pat_, gho_, etc.).');
        setIsSavingEdit(false);
        return;
      }

      // Prefix derivation
      let prefix = 'usr_';
      if (editCategory === 'Credit Card') {
        prefix = 'crd_' + editCcNumber.trim().slice(-4);
      } else if (editCategory === 'Bank Account') {
        prefix = 'bnk_' + editBaNumber.trim().slice(-4);
      } else if (editCategory === 'API Key') {
        prefix = plaintextSecret.length >= 8 ? plaintextSecret.substring(0, 8) : 'usr_api_';
      } else if (editCategory === 'Auth Secret') {
        prefix = plaintextSecret.length >= 8 ? plaintextSecret.substring(0, 8) : 'auth_sec';
      } else if (editCategory === 'GitHub Token') {
        prefix = plaintextSecret.trim().length >= 8 ? plaintextSecret.trim().substring(0, 8) : 'ghp_';
      } else {
        prefix = 'usr_' + Math.random().toString(36).substring(2, 6);
      }

      // Encrypt locally using Master Key
      const { ciphertext, iv } = await encryptClient(plaintextSecret, masterKey);

      // Call dynamic PUT API route
      const res = await fetch(`/api/secrets/${editingSecret.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          encrypted_secret: ciphertext,
          iv: iv,
          prefix: prefix,
          category: editCategory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update.');

      // Update in state list
      setSecrets(secrets.map(sec => 
        sec.id === editingSecret.id 
          ? { ...sec, name: data.name, category: data.category, prefix: data.prefix } 
          : sec
      ));

      // Close Edit Modal
      setEditingSecret(null);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || 'Failed to encrypt and save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Fetch, Decrypt & Reveal Secret (Client-Side Decryption)
  const handleRevealSecret = async (id: string, name: string) => {
    if (!masterKey) return;
    try {
      setLoadingSecretId(id);
      setErrorMsg(null);

      // Fetch encrypted payload
      const res = await fetch(`/api/secrets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retrieve payload.');

      // Decrypt locally
      const plaintext = await decryptClient(data.encrypted_secret, data.iv, masterKey);
      
      const targetSecret = secrets.find(s => s.id === id);
      setRevealedCategory(targetSecret?.category || 'API Key');
      setRevealedKey(plaintext);
      setRevealedName(name);
      
      setSecrets(secrets.map(sec => 
        sec.id === id ? { ...sec, last_used_at: new Date().toISOString() } : sec
      ));
    } catch (err: any) {
      console.error('Decryption error:', err);
      setErrorMsg('Decryption failed. Master Passphrase is invalid.');
    } finally {
      setLoadingSecretId(null);
    }
  };

  // Fetch, Decrypt & Copy to Clipboard
  const handleFetchAndCopy = async (id: string) => {
    if (!masterKey) return;
    try {
      setLoadingSecretId(id);
      setErrorMsg(null);
      
      const res = await fetch(`/api/secrets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch.');

      // Decrypt locally
      const plaintext = await decryptClient(data.encrypted_secret, data.iv, masterKey);
      
      const targetSecret = secrets.find(s => s.id === id);
      
      // If it is multi-field card/bank details, copy the main number. Else copy raw plaintext.
      let copyValue = plaintext;
      if (targetSecret?.category === 'Credit Card' || targetSecret?.category === 'Bank Account') {
        try {
          const parsed = JSON.parse(plaintext);
          copyValue = parsed.number || parsed.accountNumber || plaintext;
        } catch {
          copyValue = plaintext;
        }
      }

      await navigator.clipboard.writeText(copyValue);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      
      setSecrets(secrets.map(sec => 
        sec.id === id ? { ...sec, last_used_at: new Date().toISOString() } : sec
      ));
    } catch (err) {
      console.error('Decryption/Copy failed:', err);
      setErrorMsg('Decryption failed. Master Passphrase is invalid.');
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
      if (!res.ok) throw new Error(data.error || 'Failed to delete.');

      const nextTotal = Math.max(0, totalSecrets - 1);
      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / pageSize));
      const nextPage = currentPage > nextTotalPages ? nextTotalPages : currentPage;

      setDeleteTarget(null);
      setCurrentPage(nextPage);
      await fetchSecrets(nextPage, debouncedSearch);
      await refreshUnlockMeta();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not revoke the secret.');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string, idStr: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(idStr);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
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

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'API Key':
        return 'badge-api';
      case 'Auth Secret':
        return 'badge-auth';
      case 'GitHub Token':
        return 'badge-dev';
      case 'Password':
        return 'badge-password';
      case 'Secure Note':
        return 'badge-note';
      case 'Credit Card':
      case 'Bank Account':
        return 'badge-finance';
      case 'SSH Key':
      case 'Software License':
      case 'Crypto Seed Phrase':
        return 'badge-dev';
      default:
        return 'badge-code';
    }
  };

  const safePage = Math.min(currentPage, totalPages);
  const paginationStart = totalSecrets === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const paginationEnd = Math.min(safePage * pageSize, totalSecrets);

  // Render Lockscreen if local Master Key is not derived
  if (!masterKey) {
    return (
      <>
      {renderLogoutModal()}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1rem',
        position: 'relative'
      }}>
        <div className="glass-panel" style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem 2rem',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--glass-shadow)',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '15px',
            background: 'var(--accent-gradient)',
            marginBottom: '1.5rem',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              animation: 'pulseRadial 3s infinite cubic-bezier(0.4, 0, 0.6, 1)',
              zIndex: 0
            }} />
            <Lock size={26} color="#ffffff" style={{ position: 'relative', zIndex: 1 }} />
          </div>
          
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Unlock Dev<span className="text-gradient">Vault</span></h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Enter your master passphrase to unlock your vault.
            <strong> We never store or transmit this passphrase.</strong>
          </p>
          <div style={{ display: 'inline-block', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '2rem' }}>
            {unlockMeta.total} encrypted item{unlockMeta.total === 1 ? '' : 's'} awaiting unlock
          </div>

          {lockscreenError && (
            <div style={{
              padding: '0.75rem',
              background: 'var(--danger-glow)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <ShieldAlert size={16} />
              <span>{lockscreenError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockVault}>
            <div className="form-group" style={{ textAlign: 'left', position: 'relative' }}>
              <label htmlFor="passphrase" className="form-label">Master Passphrase</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="passphrase"
                  type={showLockscreenPassphrase ? "text" : "password"}
                  placeholder="Enter passphrase"
                  value={masterPassphrase}
                  onChange={(e) => setMasterPassphrase(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLockscreenPassphrase(!showLockscreenPassphrase)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showLockscreenPassphrase ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button 
              type="submit" 
              disabled={isDerivingKey || !masterPassphrase}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.85rem', height: 'var(--input-h)' }}
            >
              {isDerivingKey ? (
                <>
                  <Loader2 size={18} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Deriving Key...</span>
                </>
              ) : (
                <>
                  <Unlock size={18} />
                  <span>Unlock Vault</span>
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '1rem', padding: '0.85rem', height: 'var(--input-h)' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
      </>
    );
  }

  // Render Dashboard once Master Key is unlocked
  return (
    <>
    {renderLogoutModal()}
    <div className="container" style={{ minHeight: '90vh', position: 'relative' }}>
      
      {/* Header Panel */}
      <header className="glass-panel dashboard-header">
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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Encrypted vault</span>
          </div>
        </div>

        <div className="header-actions">
          <Link href="/profile" className="header-user-link" title="Edit profile">
            <User size={16} />
            <span className="header-user-email">{getDisplayName(user) || user?.email}</span>
          </Link>
          <button 
            onClick={handleLockVault} 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderColor: 'var(--warning)' }}
            title="Lock Vault & Discard Decryption Key"
          >
            <Lock size={16} style={{ color: 'var(--warning)' }} />
            <span>Lock Vault</span>
          </button>
          <button 
            onClick={() => setShowLogoutConfirm(true)} 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {showProfileBanner && (
        <div className="profile-banner">
          <p className="profile-banner-text">
            <strong>Complete your profile</strong> — add your name so it appears across DevVault.
          </p>
          <Link href="/profile" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
            Set up profile
          </Link>
        </div>
      )}

      {/* Main vault error logs if any */}
      {errorMsg && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'var(--danger-glow)',
          border: '1px solid rgba(244, 63, 94, 0.2)',
          borderRadius: 'var(--border-radius-sm)',
          color: 'var(--danger)',
          fontSize: '0.875rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <ShieldAlert size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Panel */}
      <main>
        <div className="glass-panel" style={{ padding: '2rem 1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <span>Active Keys & Secrets</span>
              <span style={{ 
                fontSize: '0.8rem', 
                background: 'rgba(255,255,255,0.06)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '20px',
                color: 'var(--text-secondary)'
              }}>
                {totalSecrets}{debouncedSearch ? ' found' : ' total'}
              </span>
            </h2>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.25rem' }}
            >
              <Plus size={18} />
              <span>Add New Secret</span>
            </button>
          </div>

          {unlockMeta.total > 0 && (
            <div className="secrets-toolbar">
              <div className="secrets-search">
                <Search size={16} className="secrets-search-icon" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name…"
                  className="form-input secrets-search-input"
                  aria-label="Search secrets by name"
                />
              </div>
              {debouncedSearch && (
                <span className="secrets-search-meta">
                  {totalSecrets} match{totalSecrets === 1 ? '' : 'es'}
                </span>
              )}
              {isLoadingSecrets && (
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
          )}

          {unlockMeta.total === 0 && !debouncedSearch ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '4rem 1rem', 
              color: 'var(--text-muted)', 
              border: '1px dashed var(--glass-border)',
              borderRadius: 'var(--border-radius-sm)'
            }}>
              <FolderOpen size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>No secrets created yet.</p>
              <p style={{ fontSize: '0.85rem' }}>Click "Add New Secret" above to start populating your encrypted vault.</p>
            </div>
          ) : totalSecrets === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-muted)',
              border: '1px dashed var(--glass-border)',
              borderRadius: 'var(--border-radius-sm)'
            }}>
              <Search size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', fontWeight: 500 }}>No secrets match &ldquo;{debouncedSearch}&rdquo;</p>
              <p style={{ fontSize: '0.85rem' }}>Try a different name or clear the search.</p>
            </div>
          ) : (
            <div style={{ opacity: isLoadingSecrets ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
              {/* Desktop Table View */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
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
                          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)' }}>
                            {sec.category}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-code">{sec.prefix}****</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={14} />
                            {new Date(sec.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {sec.last_used_at ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Clock size={14} />
                              {new Date(sec.last_used_at).toLocaleDateString()}
                            </div>
                          ) : (
                            <span style={{ opacity: 0.5 }}>Never used</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {/* Reveal Button */}
                            <button
                              onClick={() => handleRevealSecret(sec.id, sec.name)}
                              disabled={loadingSecretId !== null}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.6rem' }}
                              title="Decrypt & Reveal Secret"
                            >
                              {loadingSecretId === sec.id ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
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
                                background: copiedId === sec.id ? 'var(--success-glow)' : 'transparent',
                                color: copiedId === sec.id ? 'var(--success)' : 'inherit'
                              }}
                            >
                              {copiedId === sec.id ? <Check size={15} /> : <Copy size={15} />}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => handleStartEditSecret(sec)}
                              disabled={loadingSecretId !== null}
                              className="btn btn-secondary"
                              title="Edit Secret"
                              style={{ padding: '0.4rem 0.6rem' }}
                            >
                              <Pencil size={15} />
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

              {/* Mobile Card List */}
              <div className="secret-card-list">
                {secrets.map((sec) => (
                  <div key={`mob-${sec.id}`} className="secret-card-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="stack" style={{ gap: '0.25rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{sec.name}</div>
                        <div className="row" style={{ gap: '0.5rem' }}>
                          <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)' }}>{sec.category}</span>
                          <span className="badge badge-code" style={{ fontSize: '0.7rem' }}>{sec.prefix}****</span>
                        </div>
                      </div>
                    </div>
                    <div className="row" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
                      <div className="row" style={{ gap: '0.4rem' }}><Calendar size={14} /> {new Date(sec.created_at).toLocaleDateString()}</div>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <button onClick={() => handleRevealSecret(sec.id, sec.name)} disabled={loadingSecretId !== null} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                           {loadingSecretId === sec.id ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                        </button>
                        <button onClick={() => handleFetchAndCopy(sec.id)} disabled={loadingSecretId !== null} className="btn btn-secondary" style={{ padding: '0.4rem', color: copiedId === sec.id ? 'var(--success)' : 'inherit' }}>
                           {copiedId === sec.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button onClick={() => handleStartEditSecret(sec)} disabled={loadingSecretId !== null} className="btn btn-secondary" style={{ padding: '0.4rem' }}><Pencil size={16} /></button>
                        <button onClick={() => setDeleteTarget(sec)} className="btn btn-danger" style={{ padding: '0.4rem' }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalSecrets > pageSize && (
                <div className="secrets-pagination">
                  <span className="secrets-pagination-info">
                    {paginationStart}–{paginationEnd} of {totalSecrets}
                  </span>
                  <div className="secrets-pagination-controls">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1 || isLoadingSecrets}
                      aria-label="Previous page"
                      style={{ padding: '0.45rem 0.75rem' }}
                    >
                      <ChevronLeft size={16} />
                      <span>Prev</span>
                    </button>
                    <span className="secrets-pagination-page">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages || isLoadingSecrets}
                      aria-label="Next page"
                      style={{ padding: '0.45rem 0.75rem' }}
                    >
                      <span>Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}

      {/* 1. Add Secret Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>

            {/* ── Header ── */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'var(--accent-gradient)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 14px rgba(6,182,212,0.3)'
                  }}>
                    <Plus size={18} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Add New Secret</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.3 }}>
                      Only you can read what you save
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setNewName(''); setCustomSecretValue(''); setErrorMsg(null); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', lineHeight: 1 }}
                >
                  <span style={{ fontSize: '1.25rem' }}>✕</span>
                </button>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <form onSubmit={handleCreateSecret} style={{ display: 'contents' }}>
              <div className="modal-body">

                {errorMsg && (
                  <div style={{
                    padding: '0.65rem 0.85rem', marginBottom: '1.25rem',
                    background: 'var(--danger-glow)', border: '1px solid rgba(244,63,94,0.25)',
                    borderRadius: '8px', color: 'var(--danger)', fontSize: '0.83rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <ShieldAlert size={14} /><span>{errorMsg}</span>
                  </div>
                )}

                {/* Secret name */}
                <div className="form-group">
                  <label htmlFor="key-name" className="form-label">Name / Description</label>
                  <input
                    id="key-name" type="text"
                    placeholder="e.g. Stripe API Key, Personal Visa, DB Password"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="form-input" maxLength={80} required
                  />
                </div>

                {/* ── Category picker grid ── */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Category</label>
                  <div className="category-grid">
                    {[
                      { id: 'API Key',           icon: <Key size={20} />, label: 'API Key' },
                      { id: 'Auth Secret',        icon: <Lock size={20} />, label: 'Auth Secret' },
                      { id: 'GitHub Token',       icon: <GitHubIcon size={20} />, label: 'GitHub PAT' },
                      { id: 'Password',           icon: <ShieldCheck size={20} />, label: 'Password' },
                      { id: 'Secure Note',        icon: <FileText size={20} />, label: 'Secure Note' },
                      { id: 'SSH Key',            icon: <Terminal size={20} />, label: 'SSH Key' },
                      { id: 'Software License',   icon: <FileBadge size={20} />, label: 'SW License' },
                      { id: 'Crypto Seed Phrase', icon: <Bitcoin size={20} />, label: 'Crypto Seed' },
                      { id: 'Credit Card',        icon: <CreditCard size={20} />, label: 'Credit Card' },
                      { id: 'Bank Account',       icon: <Landmark size={20} />, label: 'Bank Account' },
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        className={`category-card${newCategory === cat.id ? ' selected' : ''}`}
                        onClick={() => handleCategorySelect(cat.id)}
                        style={{
                          borderLeftWidth: newCategory === cat.id ? '4px' : '1.5px',
                          borderLeftColor: newCategory === cat.id ? 'var(--accent-cyan)' : 'var(--glass-border)'
                        }}
                      >
                        <span className="cat-icon" style={{ display: 'flex', alignItems: 'center' }}>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>


                {/* ── Credit Card widget + fields ── */}
                {newCategory === 'Credit Card' && (
                  <>
                    {/* Visual card preview */}
                    <div className="cc-widget">
                      <div className="cc-chip" />
                      <div className="cc-number-display" style={{ fontSize: '1.3rem' }}>
                        {ccNumber
                          ? ccNumber.replace(/(.{4})/g, '$1 ').trim()
                          : '•••• •••• •••• ••••'}
                      </div>
                      <div className="cc-bottom">
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div className="cc-label">Cardholder</div>
                          <div className="cc-value" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '1rem' }}>{ccCardholder || 'FULL NAME'}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div className="cc-label">Expires</div>
                          <div className="cc-value">{ccExpiry || 'MM/YY'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Input fields */}
                    <div className="cc-fields">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Cardholder Name</label>
                        <input type="text" placeholder="Full name on card"
                          value={ccCardholder} onChange={(e) => setCcCardholder(e.target.value)}
                          className="form-input" required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Card Number</label>
                        <input type="text" placeholder="0000 0000 0000 0000"
                          value={ccNumber}
                          onChange={(e) => setCcNumber(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
                          className="form-input" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }} required />
                      </div>
                      <div className="field-row">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Expiry Date</label>
                          <input type="text" placeholder="MM/YY"
                            value={ccExpiry} onChange={(e) => setCcExpiry(e.target.value)}
                            className="form-input" required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">CVV</label>
                          <input type="password" placeholder="•••"
                            value={ccCvv} onChange={(e) => setCcCvv(e.target.value)}
                            className="form-input" maxLength={4} required />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Bank Account fields ── */}
                {newCategory === 'Bank Account' && (
                  <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '1.1rem' }}>
                    <div className="cc-fields">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Account Holder Name</label>
                        <input type="text" placeholder="Full legal name"
                          value={baHolder} onChange={(e) => setBaHolder(e.target.value)}
                          className="form-input" required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Bank Name</label>
                        <input type="text" placeholder="e.g. Chase Bank"
                          value={baBankName} onChange={(e) => setBaBankName(e.target.value)}
                          className="form-input" required />
                      </div>
                      <div className="field-row">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Account Number</label>
                          <input type="text" placeholder="Account #"
                            value={baNumber} onChange={(e) => setBaNumber(e.target.value)}
                            className="form-input" required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Routing Number <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span></label>
                          <input type="text" placeholder="Routing #"
                            value={baRouting} onChange={(e) => setBaRouting(e.target.value)}
                            className="form-input" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Multiline textarea (SSH / Note / Seed) ── */}
                {['Secure Note', 'SSH Key', 'Crypto Seed Phrase'].includes(newCategory) && (
                  <div className="form-group">
                    <label htmlFor="custom-secret" className="form-label">
                      {newCategory === 'Secure Note' ? 'Note Content' : newCategory === 'SSH Key' ? 'Private Key Block' : 'Seed Phrase (12 or 24 words)'}
                    </label>
                    <textarea
                      id="custom-secret" rows={5}
                      placeholder={newCategory === 'Crypto Seed Phrase' ? 'word1 word2 word3 ...' : `Paste your ${newCategory} here`}
                      value={customSecretValue} onChange={(e) => setCustomSecretValue(e.target.value)}
                      className="form-input"
                      style={{ resize: 'vertical', fontFamily: newCategory !== 'Secure Note' ? 'var(--font-mono)' : 'inherit', fontSize: '0.88rem' }}
                      required
                    />
                  </div>
                )}

                {/* ── Software License ── */}
                {newCategory === 'Software License' && (
                  <div className="form-group">
                    <label htmlFor="custom-secret" className="form-label">License Key / Serial</label>
                    <input id="custom-secret" type="text" placeholder="XXXX-XXXX-XXXX-XXXX"
                      value={customSecretValue} onChange={(e) => setCustomSecretValue(e.target.value)}
                      className="form-input" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} required />
                  </div>
                )}

                {/* ── API Key, Auth Secret, Password, GitHub Token ── */}
                {PASTE_SECRET_CATEGORIES.includes(newCategory as typeof PASTE_SECRET_CATEGORIES[number]) && (
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label htmlFor="custom-secret" className="form-label" style={{ marginBottom: 0 }}>
                        {newCategory === 'GitHub Token' ? 'Personal Access Token' : 'Secret Value'}
                      </label>
                      {GENERATABLE_CATEGORIES.includes(newCategory as typeof GENERATABLE_CATEGORIES[number]) && (
                        <button type="button" onClick={() => autogenerateSecret(newCategory, 'new')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          ⚡ Autogenerate
                        </button>
                      )}
                    </div>

                    {newCategory === 'Password' && renderPasswordGeneratorOptions(pwdLength, setPwdLength, pwdUpper, setPwdUpper, pwdLower, setPwdLower, pwdNumbers, setPwdNumbers, pwdSymbols, setPwdSymbols)}

                    {newCategory === 'API Key' && renderPrefixOption(apiKeyPrefix, setApiKeyPrefix)}

                    {newCategory === 'GitHub Token' && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
                        Paste a personal access token from your GitHub account settings.
                      </p>
                    )}

                    <div style={{ position: 'relative' }}>
                      <input
                        id="custom-secret"
                        type={showNewPlaintext ? 'text' : 'password'}
                        placeholder={
                          newCategory === 'GitHub Token' ? 'ghp_xxxxxxxxxxxxxxxxxxxx'
                          : newCategory === 'Password' ? 'Generated or custom password'
                          : 'Paste or autogenerate your secret'
                        }
                        value={customSecretValue}
                        onChange={(e) => setCustomSecretValue(e.target.value)}
                        className="form-input"
                        style={{ paddingRight: '2.5rem', fontFamily: 'var(--font-mono)' }}
                        required
                      />
                      <button type="button" onClick={() => setShowNewPlaintext(!showNewPlaintext)} className="btn" style={{ position: 'absolute', right: '0.25rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '0.5rem', color: 'var(--text-secondary)' }}>
                        {showNewPlaintext ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}



              </div>

              {/* ── Footer ── */}
              <div className="modal-footer">
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button"
                    onClick={() => { setIsAddModalOpen(false); setNewName(''); setCustomSecretValue(''); setErrorMsg(null); }}
                    className="btn btn-secondary" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isGenerating || !newName.trim()}
                    className="btn btn-primary" style={{ flex: 2 }}>
                    {isGenerating ? (
                      <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /><span>Encrypting…</span></>
                    ) : (
                      <><Lock size={15} /><span>Encrypt & Save</span></>
                    )}
                  </button>
                </div>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 2. Edit Secret Modal */}
      {editingSecret && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 'var(--modal-max-w)' }}>
            
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(6,182,212,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(6,182,212,0.3)',
                    boxShadow: '0 0 14px rgba(6,182,212,0.2)'
                  }}>
                    <Pencil size={18} color="var(--accent-cyan)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Edit Secret</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.3 }}>
                      Only you can read what you save
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSecret(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', lineHeight: 1 }}
                >
                  <span style={{ fontSize: '1.25rem' }}>✕</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveEditSecret} style={{ display: 'contents' }}>
              <div className="modal-body">
                {editError && (
                  <div style={{
                    padding: '0.65rem 0.85rem', marginBottom: '1.25rem',
                    background: 'var(--danger-glow)', border: '1px solid rgba(244,63,94,0.25)',
                    borderRadius: '8px', color: 'var(--danger)', fontSize: '0.83rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <ShieldAlert size={14} /><span>{editError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="edit-name" className="form-label">Secret Description Name</label>
                  <input
                    id="edit-name" type="text" value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="form-input" maxLength={80} required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <div>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                      {editCategory}
                    </span>
                  </div>
                </div>

                {/* Edit Category: Credit Card */}
                {editCategory === 'Credit Card' && (
                  <div className="cc-fields" style={{ marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Cardholder Name</label>
                      <input type="text" value={editCcCardholder} onChange={(e) => setEditCcCardholder(e.target.value)} className="form-input" required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Card Number</label>
                      <input type="text" value={editCcNumber} onChange={(e) => setEditCcNumber(e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))} className="form-input" style={{ fontFamily: 'var(--font-mono)' }} required />
                    </div>
                    <div className="field-row">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Expiry Date</label>
                        <input type="text" value={editCcExpiry} onChange={(e) => setEditCcExpiry(e.target.value)} className="form-input" required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">CVV</label>
                        <input type="password" value={editCcCvv} onChange={(e) => setEditCcCvv(e.target.value)} className="form-input" maxLength={4} required />
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Category: Bank Account */}
                {editCategory === 'Bank Account' && (
                  <div className="cc-fields" style={{ marginTop: '0.5rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Account Holder Name</label>
                      <input type="text" value={editBaHolder} onChange={(e) => setEditBaHolder(e.target.value)} className="form-input" required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Bank Name</label>
                      <input type="text" value={editBaBankName} onChange={(e) => setEditBaBankName(e.target.value)} className="form-input" required />
                    </div>
                    <div className="field-row">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Account Number</label>
                        <input type="text" value={editBaNumber} onChange={(e) => setEditBaNumber(e.target.value)} className="form-input" required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Routing Number <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(Optional)</span></label>
                        <input type="text" value={editBaRouting} onChange={(e) => setEditBaRouting(e.target.value)} className="form-input" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Edit Category: Secure Note / SSH Key / Crypto Seed Phrase (Multiline textareas) */}
                {['Secure Note', 'SSH Key', 'Crypto Seed Phrase'].includes(editCategory) && (
                  <div className="form-group">
                    <label htmlFor="edit-value" className="form-label">Content</label>
                    <textarea id="edit-value" rows={6} value={editSecretValue} onChange={(e) => setEditSecretValue(e.target.value)} className="form-input" style={{ resize: 'vertical', fontFamily: editCategory !== 'Secure Note' ? 'var(--font-mono)' : 'inherit' }} required />
                  </div>
                )}

                {/* Edit Category: Software License, API Key, Auth Secret, Password, GitHub Token */}
                {!['Credit Card', 'Bank Account', 'Secure Note', 'SSH Key', 'Crypto Seed Phrase'].includes(editCategory) && (
                  <div className="form-group" style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label htmlFor="edit-value" className="form-label" style={{ marginBottom: 0 }}>
                        {editCategory === 'GitHub Token' ? 'Personal Access Token' : 'Secret Value'}
                      </label>
                      {GENERATABLE_CATEGORIES.includes(editCategory as typeof GENERATABLE_CATEGORIES[number]) && (
                        <button type="button" onClick={() => autogenerateSecret(editCategory, 'edit')} style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          ⚡ Autogenerate
                        </button>
                      )}
                    </div>

                    {editCategory === 'Password' && renderPasswordGeneratorOptions(pwdLength, setPwdLength, pwdUpper, setPwdUpper, pwdLower, setPwdLower, pwdNumbers, setPwdNumbers, pwdSymbols, setPwdSymbols)}

                    {editCategory === 'API Key' && renderPrefixOption(apiKeyPrefix, setApiKeyPrefix)}

                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                      <input id="edit-value" type={showEditPlaintext ? 'text' : 'password'} value={editSecretValue} onChange={(e) => setEditSecretValue(e.target.value)} className="form-input" style={{ paddingRight: '3rem', fontFamily: 'var(--font-mono)' }} required />
                      <button type="button" onClick={() => setShowEditPlaintext(!showEditPlaintext)} className="btn" style={{ position: 'absolute', right: '0.25rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '0.5rem', color: 'var(--text-secondary)' }}>
                        {showEditPlaintext ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => setEditingSecret(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={isSavingEdit || !editName.trim()} className="btn btn-primary" style={{ flex: 1 }}>
                  {isSavingEdit ? <><Loader2 size={16} className="animate-spin" /><span>Saving...</span></> : <span>Save Changes</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Newly Generated Key Modal (Show Once Notice) */}
      {newlyGeneratedKey && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 'var(--modal-max-w)' }}>
            
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(6,182,212,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(6,182,212,0.3)',
                    boxShadow: '0 0 14px rgba(6,182,212,0.2)'
                  }}>
                    <Lock size={18} color="var(--accent-cyan)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Key Generated</h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
                Here is your secure API key for <span className="badge">{newlyGeneratedName}</span>. Since it was encrypted client-side, make sure to copy it now.
              </p>

              <div className="secret-value-box" style={{ 
                borderColor: 'rgba(6,182,212,0.3)', 
                background: 'rgba(6,182,212,0.08)',
                color: 'var(--accent-cyan)'
              }}>
                {newlyGeneratedKey}
                <button
                  onClick={() => copyToClipboard(newlyGeneratedKey, 'gen-modal')}
                  className="btn btn-secondary"
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    padding: '0.35rem',
                    background: 'var(--bg-secondary)',
                    borderColor: copiedId === 'gen-modal' ? 'var(--success)' : 'var(--glass-border)',
                    color: copiedId === 'gen-modal' ? 'var(--success)' : 'inherit'
                  }}
                >
                  {copiedId === 'gen-modal' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>


            </div>

            <div className="modal-footer">
              <button
                onClick={() => {
                  setNewlyGeneratedKey(null);
                  setNewlyGeneratedName('');
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Got it — Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Revealed Secret Modal (Custom render for Credit Card and Bank Accounts) */}
      {revealedKey && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 'var(--modal-max-w)' }}>
            
            {/* Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(168,85,247,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(168,85,247,0.3)',
                    boxShadow: '0 0 14px rgba(168,85,247,0.2)'
                  }}>
                    <Eye size={18} color="var(--accent-purple)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Decrypt & View</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.3 }}>
                      Plaintext for <span className="badge" style={{ padding: '0.1rem 0.3rem', fontSize: '0.7rem' }}>{revealedName}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setRevealedKey(null); setRevealedName(''); setRevealedCategory(''); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', borderRadius: '6px', lineHeight: 1 }}
                >
                  <span style={{ fontSize: '1.25rem' }}>✕</span>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="modal-body">
              {revealedCategory === 'Credit Card' ? (() => {
                let cc = { cardholder: '', number: '', expiry: '', cvv: '' };
                try { cc = JSON.parse(revealedKey); } catch (e) {}
                return (
                  <div className="stack" style={{ background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>CARDHOLDER</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cc.cardholder}</span>
                        <button onClick={() => copyToClipboard(cc.cardholder, 'rev-cc-name')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-cc-name' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: 0 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>CARD NUMBER</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.9rem' }}>{cc.number}</span>
                        <button onClick={() => copyToClipboard(cc.number, 'rev-cc-num')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-cc-num' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: 0 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>EXPIRY</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{cc.expiry}</span>
                        <button onClick={() => copyToClipboard(cc.expiry, 'rev-cc-exp')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-cc-exp' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: 0 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>CVV</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{cc.cvv}</span>
                        <button onClick={() => copyToClipboard(cc.cvv, 'rev-cc-cvv')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-cc-cvv' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })() : revealedCategory === 'Bank Account' ? (() => {
                let ba = { holder: '', bankName: '', accountNumber: '', routingNumber: '' };
                try { ba = JSON.parse(revealedKey); } catch (e) {}
                return (
                  <div className="stack" style={{ background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>ACCOUNT HOLDER</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ba.holder}</span>
                        <button onClick={() => copyToClipboard(ba.holder, 'rev-ba-holder')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-ba-holder' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: 0 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>BANK NAME</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{ba.bankName}</span>
                        <button onClick={() => copyToClipboard(ba.bankName, 'rev-ba-bank')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-ba-bank' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: 0 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>ACCOUNT NUMBER</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.9rem' }}>{ba.accountNumber}</span>
                        <button onClick={() => copyToClipboard(ba.accountNumber, 'rev-ba-num')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-ba-num' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                    <div className="divider" style={{ margin: 0 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>ROUTING NUMBER</span>
                      <div className="row" style={{ gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{ba.routingNumber}</span>
                        <button onClick={() => copyToClipboard(ba.routingNumber, 'rev-ba-rout')} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }}>
                          {copiedId === 'rev-ba-rout' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                /* Regular Secret Box */
                <div className="secret-value-box">
                  {revealedKey}
                  <button
                    onClick={() => copyToClipboard(revealedKey, 'rev-modal')}
                    className="btn btn-secondary"
                    style={{
                      position: 'absolute',
                      top: '0.5rem',
                      right: '0.5rem',
                      padding: '0.35rem',
                      background: 'var(--bg-secondary)',
                      borderColor: copiedId === 'rev-modal' ? 'var(--success)' : 'var(--glass-border)',
                      color: copiedId === 'rev-modal' ? 'var(--success)' : 'inherit'
                    }}
                  >
                    {copiedId === 'rev-modal' ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                onClick={() => { setRevealedKey(null); setRevealedName(''); setRevealedCategory(''); }}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete / Revocation Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-content">
            
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(244,63,94,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(244,63,94,0.3)',
                    boxShadow: '0 0 14px rgba(244,63,94,0.2)'
                  }}>
                    <Trash2 size={18} color="var(--danger)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', margin: 0 }}>Delete Permanently</h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <span className="badge" style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</span>? 
                This action cannot be undone. Any clients or applications using this secret will be unauthorized.
              </p>
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '1rem' }}>
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

      {/* Category styles definition */}
      <style jsx global>{`
        /* Spin Animation */
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        /* Category Badge Colors */
        .badge-api {
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.3);
          color: var(--accent-cyan);
        }
        .badge-auth {
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.3);
          color: var(--accent-purple);
        }
        .badge-password {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: var(--warning);
        }
        .badge-note {
          background: rgba(148, 163, 184, 0.1);
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: var(--text-secondary);
        }
        .badge-finance {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: var(--danger);
        }
        .badge-dev {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: var(--success);
        }
      `}</style>

    </div>
    </>
  );
}
