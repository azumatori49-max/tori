import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { isPermissionError, withRetry } from '../lib/retry';
import { ADMIN_EMAIL } from '../config';
import type { AuthState, StoreKey } from '../types';

const STORAGE_KEY = 'rakuraku-eisei-auth';

const load = (): AuthState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeKey: null, isAdmin: false };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { storeKey: null, isAdmin: false };
  }
};

/**
 * 認証まわり。画面遷移は元アプリと同じ localStorage ベースだが、
 * 実際の読み書き権限は Firebase Auth ＋ セキュリティルールで強制する。
 *
 *  - 管理者: メール＋パスワードでログイン（Firebase Auth のアカウント）。
 *    店舗の追加・削除などはこのアカウントだけがサーバー側で許可される。
 *  - 店舗: 匿名ログイン後、storeSessions/{uid} に「店舗キー＋パスワード」を書く。
 *    パスワードが正しいかどうかはセキュリティルールがサーバー側で検証し、
 *    間違っていれば書き込み自体が拒否される（＝ログイン失敗）。
 */
export const useAuth = () => {
  const [auth_, setAuth] = useState<AuthState>(() => load());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth_));
  }, [auth_]);

  // Firebase 側のセッションと localStorage の食い違いを補正する
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const current = load();
      if (!user) {
        // Firebase セッションが無いのに画面だけログイン済みなら戻す
        if (current.storeKey || current.isAdmin || current.isViewer) {
          setAuth({ storeKey: null, isAdmin: false });
        }
        return;
      }
      if (current.isAdmin && user.email !== ADMIN_EMAIL) {
        void fbSignOut(auth);
        setAuth({ storeKey: null, isAdmin: false });
      }
    });
    return () => unsub();
  }, []);

  /** 店舗ログイン。成功時 null、失敗時はエラーメッセージを返す */
  const loginStore = useCallback(
    async (storeKey: StoreKey, password: string): Promise<string | null> => {
      try {
        // 管理者としてログイン中なら一旦サインアウト
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          await fbSignOut(auth);
        }
        const user =
          auth.currentUser ?? (await withRetry(() => signInAnonymously(auth))).user;
        // パスワード検証はセキュリティルール側で行われる
        // （storePasswords と一致しない書き込みは permission-denied になる）
        await withRetry(() =>
          setDoc(doc(db, 'storeSessions', user.uid), {
            storeKey,
            password,
            createdAt: serverTimestamp(),
          })
        );
        setAuth({ storeKey, isAdmin: false });
        return null;
      } catch (e) {
        if (isPermissionError(e)) return 'パスワードが違います';
        return '通信に失敗しました。電波の良い場所で再度お試しください。';
      }
    },
    []
  );

  /** 閲覧専用ログイン。成功時 null、失敗時はエラーメッセージを返す */
  const loginViewer = useCallback(async (password: string): Promise<string | null> => {
    try {
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await fbSignOut(auth);
      }
      const user =
        auth.currentUser ?? (await withRetry(() => signInAnonymously(auth))).user;
      // パスワード照合はセキュリティルール（settings/viewer と比較）が行う
      await withRetry(() =>
        setDoc(doc(db, 'viewerSessions', user.uid), {
          password,
          createdAt: serverTimestamp(),
        })
      );
      setAuth({ storeKey: null, isAdmin: false, isViewer: true });
      return null;
    } catch (e) {
      if (isPermissionError(e)) return 'パスワードが違います';
      return '通信に失敗しました。電波の良い場所で再度お試しください。';
    }
  }, []);

  /** 管理者ログイン。成功時 null、失敗時はエラーメッセージを返す */
  const loginAdmin = useCallback(async (password: string): Promise<string | null> => {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
      setAuth({ storeKey: '__admin__', isAdmin: true });
      return null;
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/network-request-failed') {
        return '通信に失敗しました。電波の良い場所で再度お試しください。';
      }
      return '管理者パスワードが違います';
    }
  }, []);

  const logout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    const wasAnon = auth.currentUser?.isAnonymous;
    setAuth({ storeKey: null, isAdmin: false });
    try {
      if (wasAnon && uid) {
        await deleteDoc(doc(db, 'storeSessions', uid)).catch(() => undefined);
        await deleteDoc(doc(db, 'viewerSessions', uid)).catch(() => undefined);
      }
      await fbSignOut(auth);
    } catch {
      // ログアウトは失敗しても画面上は戻す
    }
  }, []);

  return { auth: auth_, loginStore, loginAdmin, loginViewer, logout };
};
