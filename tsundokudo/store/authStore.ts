/**
 * 認証・組織ストア（Firebase / Google Cloud）。クラウド有効時のみ使用。
 *
 * マルチテナント:
 *   - ログインユーザーは「組織（会社）」に所属し、データは組織ごとに分離される
 *   - 新規登録後は「組織を作成」or「招待コードで参加」
 *   - 閲覧は組織ごとの閲覧用リンク（トークン）から。
 *     匿名認証＋viewerSessions で読み取りのみ許可される
 *
 * Firestore 構成:
 *   users/{uid}            … { orgId, role, inviteCode?, createdAt }
 *   orgs/{orgId}           … { name, inviteCode, viewerToken, createdBy, createdAt }
 *   inviteCodes/{code}     … { orgId }（招待コード→組織の逆引き）
 *   viewerLinks/{token}    … { orgId, orgName }（閲覧トークン→組織の逆引き）
 *   viewerSessions/{uid}   … { orgId, token, createdAt }（匿名閲覧者の入場券）
 */
import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';

import { fbAuth, fbDb } from '@/lib/firebase';
import { persist } from '@/lib/persist';

const GUEST_ORG_KEY = 'auth:guestOrg';

export interface OrgInfo {
  id: string;
  name: string;
  role: 'admin' | 'member';
  inviteCode: string;
  viewerToken: string;
}

interface GuestOrg {
  token: string;
  name: string;
  orgId: string;
}

/** ランダムな16進文字列（bytes×2文字） */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface AuthState {
  /** ログイン中のユーザー（匿名閲覧者は含まない） */
  user: User | null;
  /** 所属組織（未所属なら null） */
  org: OrgInfo | null;
  /** 所属確認が完了したか（ログイン後） */
  orgChecked: boolean;
  /** 閲覧用リンクで開いているゲスト状態 */
  guestOrg: GuestOrg | null;
  /** 初回のセッション確認が完了したか */
  ready: boolean;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  /** 組織を新規作成（作成者はadmin） */
  createOrg: (name: string) => Promise<boolean>;
  /** 招待コードで組織に参加 */
  joinOrg: (code: string) => Promise<boolean>;
  /** 閲覧用リンクのトークンでゲスト閲覧を開始 */
  enterGuestByToken: (token: string) => Promise<boolean>;
  /** 招待コード/閲覧リンクの再発行（adminのみ） */
  rotateOrgCode: (kind: 'invite' | 'viewer') => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

/** 現在閲覧専用モードか（閲覧リンクで開いている） */
export function useIsViewer(): boolean {
  return useAuthStore((s) => s.guestOrg != null);
}

/** enterGuestByToken 実行中フラグ（匿名ログイン直後の誤サインアウト防止） */
let guestEntryInProgress = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  org: null,
  orgChecked: false,
  guestOrg: null,
  ready: false,
  loading: false,
  error: null,

  init: async () => {
    if (!fbAuth) {
      set({ ready: true, orgChecked: true });
      return;
    }
    const guestRaw = await persist.getItem(GUEST_ORG_KEY);
    let storedGuest: GuestOrg | null = null;
    if (guestRaw) {
      try {
        storedGuest = JSON.parse(guestRaw) as GuestOrg;
      } catch {
        storedGuest = null;
      }
    }

    onAuthStateChanged(fbAuth, (user) => {
      if (user && !user.isAnonymous) {
        // 通常ログイン
        set({ user, guestOrg: null, orgChecked: false });
        void persist.removeItem(GUEST_ORG_KEY);
        void loadOrg(set, user.uid);
      } else if (user && user.isAnonymous) {
        // 匿名（閲覧リンク）。保存済みのゲスト情報がなければ破棄
        const guest = get().guestOrg ?? storedGuest;
        if (guest) {
          set({ user: null, guestOrg: guest, orgChecked: true });
        } else if (!guestEntryInProgress) {
          void fbSignOut(fbAuth!);
          set({ user: null, orgChecked: true });
        }
      } else {
        set({ user: null, org: null, orgChecked: true });
      }
      set({ ready: true });
    });
  },

  signIn: async (email, password) => {
    if (!fbAuth) return false;
    set({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(fbAuth, email.trim(), password);
      set({ loading: false });
      return true;
    } catch {
      set({ loading: false, error: 'メールアドレスまたはパスワードが正しくありません。' });
      return false;
    }
  },

  signUp: async (email, password) => {
    if (!fbAuth) return false;
    set({ loading: true, error: null });
    try {
      await createUserWithEmailAndPassword(fbAuth, email.trim(), password);
      set({ loading: false });
      return true;
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      set({
        loading: false,
        error: code.includes('weak-password')
          ? 'パスワードは6文字以上にしてください。'
          : code.includes('email-already-in-use')
            ? 'このメールアドレスは登録済みです。ログインしてください。'
            : code.includes('invalid-email')
              ? 'メールアドレスの形式が正しくありません。'
              : '登録に失敗しました。時間をおいて再度お試しください。',
      });
      return false;
    }
  },

  createOrg: async (name) => {
    const uid = fbAuth?.currentUser?.uid;
    if (!fbDb || !uid) return false;
    set({ loading: true, error: null });
    try {
      const orgRef = doc(collection(fbDb, 'orgs'));
      const inviteCode = randomHex(6);
      const viewerToken = randomHex(16);
      const orgName = name.trim();
      const batch = writeBatch(fbDb);
      batch.set(orgRef, {
        name: orgName,
        inviteCode,
        viewerToken,
        createdBy: uid,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(fbDb, 'inviteCodes', inviteCode), { orgId: orgRef.id });
      batch.set(doc(fbDb, 'viewerLinks', viewerToken), { orgId: orgRef.id, orgName });
      batch.set(doc(fbDb, 'users', uid), {
        orgId: orgRef.id,
        role: 'admin',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      set({
        org: { id: orgRef.id, name: orgName, role: 'admin', inviteCode, viewerToken },
        orgChecked: true,
        loading: false,
      });
      return true;
    } catch {
      set({ loading: false, error: '会社の作成に失敗しました。' });
      return false;
    }
  },

  joinOrg: async (code) => {
    const uid = fbAuth?.currentUser?.uid;
    if (!fbDb || !uid) return false;
    set({ loading: true, error: null });
    try {
      const trimmed = code.trim();
      const inviteSnap = await getDoc(doc(fbDb, 'inviteCodes', trimmed));
      if (!inviteSnap.exists()) throw new Error('invalid');
      const orgId = (inviteSnap.data() as { orgId: string }).orgId;
      await setDoc(doc(fbDb, 'users', uid), {
        orgId,
        role: 'member',
        inviteCode: trimmed,
        createdAt: serverTimestamp(),
      });
      const org = await fetchOrgInfo(orgId, 'member');
      if (!org) throw new Error('org');
      set({ org, orgChecked: true, loading: false });
      return true;
    } catch {
      set({ loading: false, error: '招待コードが正しくありません。' });
      return false;
    }
  },

  enterGuestByToken: async (token) => {
    if (!fbAuth || !fbDb) return false;
    const t = token.trim();
    if (!t) return false;
    // 通常ログイン中はゲスト化しない（既存セッションを壊さない）
    if (fbAuth.currentUser && !fbAuth.currentUser.isAnonymous) return false;
    guestEntryInProgress = true;
    try {
      const cred = fbAuth.currentUser?.isAnonymous
        ? { user: fbAuth.currentUser }
        : await signInAnonymously(fbAuth);
      const linkSnap = await getDoc(doc(fbDb, 'viewerLinks', t));
      if (!linkSnap.exists()) return false;
      const { orgId, orgName } = linkSnap.data() as { orgId: string; orgName: string };
      await setDoc(doc(fbDb, 'viewerSessions', cred.user.uid), {
        orgId,
        token: t,
        createdAt: serverTimestamp(),
      });
      const guestOrg: GuestOrg = { token: t, name: orgName, orgId };
      set({ guestOrg });
      void persist.setItem(GUEST_ORG_KEY, JSON.stringify(guestOrg));
      return true;
    } catch {
      return false;
    } finally {
      guestEntryInProgress = false;
    }
  },

  rotateOrgCode: async (kind) => {
    const org = get().org;
    if (!fbDb || !org) return false;
    try {
      const batch = writeBatch(fbDb);
      if (kind === 'invite') {
        const next = randomHex(6);
        batch.delete(doc(fbDb, 'inviteCodes', org.inviteCode));
        batch.set(doc(fbDb, 'inviteCodes', next), { orgId: org.id });
        batch.update(doc(fbDb, 'orgs', org.id), { inviteCode: next });
        await batch.commit();
        set({ org: { ...org, inviteCode: next } });
      } else {
        const next = randomHex(16);
        batch.delete(doc(fbDb, 'viewerLinks', org.viewerToken));
        batch.set(doc(fbDb, 'viewerLinks', next), { orgId: org.id, orgName: org.name });
        batch.update(doc(fbDb, 'orgs', org.id), { viewerToken: next });
        await batch.commit();
        set({ org: { ...org, viewerToken: next } });
      }
      return true;
    } catch {
      set({ error: '再発行に失敗しました。' });
      return false;
    }
  },

  signOut: async () => {
    if (get().guestOrg) {
      // 閲覧終了: 入場券を消して匿名セッションも破棄
      const uid = fbAuth?.currentUser?.uid;
      if (fbDb && uid) {
        void deleteDoc(doc(fbDb, 'viewerSessions', uid)).catch(() => undefined);
      }
      if (fbAuth) await fbSignOut(fbAuth).catch(() => undefined);
      set({ guestOrg: null });
      void persist.removeItem(GUEST_ORG_KEY);
      return;
    }
    if (!fbAuth) return;
    await fbSignOut(fbAuth);
    set({ user: null, org: null });
  },

  clearError: () => set({ error: null }),
}));

/** 組織情報を取得して OrgInfo に整形 */
async function fetchOrgInfo(orgId: string, role: 'admin' | 'member'): Promise<OrgInfo | null> {
  if (!fbDb) return null;
  const snap = await getDoc(doc(fbDb, 'orgs', orgId));
  if (!snap.exists()) return null;
  const d = snap.data() as { name: string; inviteCode: string; viewerToken: string };
  return {
    id: orgId,
    name: d.name,
    role,
    inviteCode: d.inviteCode,
    viewerToken: d.viewerToken,
  };
}

/** 所属組織を取得して state に反映 */
async function loadOrg(
  set: (partial: Partial<AuthState>) => void,
  uid: string,
): Promise<void> {
  if (!fbDb) return;
  try {
    const userSnap = await getDoc(doc(fbDb, 'users', uid));
    if (!userSnap.exists()) {
      set({ org: null, orgChecked: true });
      return;
    }
    const { orgId, role } = userSnap.data() as { orgId: string; role: string };
    const org = await fetchOrgInfo(orgId, role === 'admin' ? 'admin' : 'member');
    set({ org, orgChecked: true });
  } catch {
    set({ org: null, orgChecked: true });
  }
}
