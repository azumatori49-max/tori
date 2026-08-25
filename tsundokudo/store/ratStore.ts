/**
 * ネズミ駆除契約のストア。
 * クラウド有効時は Firestore、無効時は端末ローカル保存。
 */
import { create } from 'zustand';

import { persist } from '@/lib/persist';
import { isCloudEnabled } from '@/lib/firebase';
import {
  cloudDeleteRatContract,
  cloudFetchRatContracts,
  cloudUpsertRatContract,
  normalizeRatContract,
} from '@/lib/cloudRat';
import { useAuthStore } from '@/store/authStore';
import type { RatContract, RatContractInsert } from '@/types/rat';

const RAT_KEY = 'hygiene:ratContracts';

function requireOrgId(): string {
  const a = useAuthStore.getState();
  const orgId = a.org?.id ?? a.guestOrg?.orgId;
  if (!orgId) {
    throw new Error('組織情報が取得できません。一度ログアウトして再ログインしてください。');
  }
  return orgId;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : '保存に失敗しました。';
}

interface RatState {
  contracts: RatContract[];
  hydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  getContract: (id: string) => RatContract | undefined;
  createContract: (data: RatContractInsert) => Promise<boolean>;
  updateContract: (id: string, data: Partial<RatContractInsert>) => Promise<boolean>;
  deleteContract: (id: string) => Promise<boolean>;
}

export const useRatStore = create<RatState>((set, get) => ({
  contracts: [],
  hydrated: false,
  error: null,

  hydrate: async () => {
    try {
      if (isCloudEnabled) {
        const contracts = await cloudFetchRatContracts(requireOrgId());
        set({ contracts, hydrated: true, error: null });
      } else {
        const raw = await persist.getItem(RAT_KEY);
        const contracts = raw ? (JSON.parse(raw) as RatContract[]).map(normalizeRatContract) : [];
        set({ contracts, hydrated: true, error: null });
      }
    } catch (e) {
      set({ hydrated: true, error: errMessage(e) });
    }
  },

  getContract: (id) => get().contracts.find((c) => c.id === id),

  createContract: async (data) => {
    const now = new Date().toISOString();
    const contract: RatContract = { ...data, id: newId(), createdAt: now, updatedAt: now };
    const prev = get().contracts;
    set({ contracts: [contract, ...prev], error: null });
    try {
      if (isCloudEnabled) {
        const saved = await cloudUpsertRatContract(contract, requireOrgId());
        set({ contracts: get().contracts.map((c) => (c.id === saved.id ? saved : c)) });
      } else {
        await persist.setItem(RAT_KEY, JSON.stringify(get().contracts));
      }
      return true;
    } catch (e) {
      set({ contracts: prev, error: errMessage(e) });
      return false;
    }
  },

  updateContract: async (id, data) => {
    const prev = get().contracts;
    const contracts = prev.map((c) =>
      c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c,
    );
    const updated = contracts.find((c) => c.id === id);
    set({ contracts, error: null });
    try {
      if (isCloudEnabled) {
        if (updated) {
          const saved = await cloudUpsertRatContract(updated, requireOrgId());
          set({ contracts: get().contracts.map((c) => (c.id === saved.id ? saved : c)) });
        }
      } else {
        await persist.setItem(RAT_KEY, JSON.stringify(contracts));
      }
      return true;
    } catch (e) {
      set({ contracts: prev, error: errMessage(e) });
      return false;
    }
  },

  deleteContract: async (id) => {
    const prev = get().contracts;
    const contracts = prev.filter((c) => c.id !== id);
    set({ contracts, error: null });
    try {
      if (isCloudEnabled) {
        await cloudDeleteRatContract(id, requireOrgId());
      } else {
        await persist.setItem(RAT_KEY, JSON.stringify(contracts));
      }
      return true;
    } catch (e) {
      set({ contracts: prev, error: errMessage(e) });
      return false;
    }
  },
}));
