'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type VaultSessionContextValue = {
  masterKey: CryptoKey | null;
  setMasterKey: (key: CryptoKey | null) => void;
  lockVault: () => void;
};

const VaultSessionContext = createContext<VaultSessionContextValue | null>(null);

export function VaultSessionProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);

  const lockVault = useCallback(() => {
    setMasterKey(null);
  }, []);

  return (
    <VaultSessionContext.Provider value={{ masterKey, setMasterKey, lockVault }}>
      {children}
    </VaultSessionContext.Provider>
  );
}

export function useVaultSession() {
  const context = useContext(VaultSessionContext);
  if (!context) {
    throw new Error('useVaultSession must be used within VaultSessionProvider');
  }
  return context;
}
