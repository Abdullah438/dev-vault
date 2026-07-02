'use client';

import { useEffect } from 'react';
import { VAULT_IDLE_LOCK_MS } from '@/lib/vault-constants';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'] as const;

/**
 * Locks the vault after a period of user inactivity.
 */
export function useAutoLock(lockVault: () => void, enabled: boolean, idleMs: number = VAULT_IDLE_LOCK_MS) {
  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(lockVault, idleMs);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [lockVault, enabled, idleMs]);
}
