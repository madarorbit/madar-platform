import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { MobileDashboardSnapshot } from '@madar/contracts/mobile-v2';
import { ApiError, mobileApi } from '@/lib/api';
import { registerMadarPush } from '@/lib/push';
import { getSecureJson, secureKeyValue, setSecureJson } from '@/lib/secure-store';
import { useAuth } from '@/providers/auth-provider';

const workspaceKey = 'madar-mobile-v2-workspace';
const cacheKey = (userId: string, workspaceId?: string | null) =>
  `madar-mobile-v2-cache:${userId}:${workspaceId || 'default'}`;

type AppContextValue = {
  snapshot: MobileDashboardSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  online: boolean;
  stale: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
};
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const [snapshot, setSnapshot] = useState<MobileDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    secureKeyValue.getItem(workspaceKey).then(setWorkspaceId);
    const subscription = NetInfo.addEventListener((state) =>
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)),
    );
    return subscription;
  }, []);

  const load = useCallback(async (manual = false, requestedWorkspace = workspaceId) => {
    if (!session) return;
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);
    const key = cacheKey(session.user.id, requestedWorkspace);
    try {
      const fresh = await mobileApi.bootstrap(session.access_token, requestedWorkspace);
      setSnapshot(fresh);
      setWorkspaceId(fresh.workspace.id);
      await Promise.all([
        secureKeyValue.setItem(workspaceKey, fresh.workspace.id),
        setSecureJson(key, fresh),
        setSecureJson(cacheKey(session.user.id, fresh.workspace.id), fresh),
      ]);
    } catch (cause) {
      const cached = await getSecureJson<MobileDashboardSnapshot>(key);
      if (cached) {
        setSnapshot(cached);
        setError('تعذر التحديث، وتُعرض آخر نسخة مشفرة محفوظة على الجهاز.');
      } else {
        const message = cause instanceof Error ? cause.message : 'تعذر فتح لوحة القيادة.';
        setError(message);
      }
      if (cause instanceof ApiError && cause.status === 401) await signOut('local');
      if (cause instanceof ApiError && cause.status === 403 && cause.message.includes('حسابات الأعمال')) {
        await signOut('local');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, signOut, workspaceId]);

  useEffect(() => {
    if (!session) return;
    getSecureJson<MobileDashboardSnapshot>(cacheKey(session.user.id, workspaceId)).then((cached) => {
      if (cached) setSnapshot(cached);
      void load(false, workspaceId);
    });
  }, [session, workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!online || !session) return;
    const timer = setInterval(() => void load(false), 60_000);
    return () => clearInterval(timer);
  }, [load, online, session]);

  useEffect(() => {
    if (!online || !session || !snapshot?.capabilities.canUsePush) return;
    void registerMadarPush(session.access_token, snapshot.workspace.id).catch(() => null);
  }, [online, session, snapshot?.workspace.id, snapshot?.capabilities.canUsePush]);

  const value = useMemo<AppContextValue>(() => ({
    snapshot,
    loading,
    refreshing,
    online,
    stale: !online || Boolean(snapshot?.sync.isStale),
    error,
    refresh: () => load(true),
    selectWorkspace: async (next) => {
      setWorkspaceId(next);
      await secureKeyValue.setItem(workspaceKey, next);
      await load(true, next);
    },
  }), [error, load, loading, online, refreshing, snapshot]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useMadarApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProviderMissing');
  return value;
}
