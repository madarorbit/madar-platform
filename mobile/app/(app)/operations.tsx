import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import type { MobileOperation } from '@madar/contracts/mobile-v2';
import { PageHeader, Screen } from '@/components/screen';
import { AppButton, Badge, Card, EmptyState, Skeleton } from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { useMadarApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

const statusLabel: Record<string, string> = { draft: 'مسودة', previewed: 'تمت المعاينة', queued: 'في الانتظار', sending: 'جاري الإرسال', executed: 'تم التنفيذ في النظام', synced: 'تمت مزامنة مَدار', failed: 'فشل التنفيذ', needs_review: 'يحتاج مراجعة', cancelled: 'ملغي' };
const tone = (status: string) => status === 'synced' || status === 'executed' ? 'good' as const : status === 'failed' ? 'danger' as const : status === 'needs_review' || status === 'queued' || status === 'sending' ? 'warn' as const : 'neutral' as const;
const dateTime = (value: string) => new Date(value).toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' });

export default function OperationsScreen() {
  const { session } = useAuth();
  const { snapshot } = useMadarApp();
  const { colors } = useMadarTheme();
  const [items, setItems] = useState<MobileOperation[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (append = false) => {
    if (!session || !snapshot) return;
    setLoading(true);
    try { const page = await mobileApi.operations(session.access_token, snapshot.workspace.id, append ? cursor : null); setItems((current) => append ? [...current, ...page.items] : page.items); setCursor(page.nextCursor); setHasMore(page.hasMore); }
    catch (error) { Alert.alert('تعذر تحميل العمليات', error instanceof Error ? error.message : 'أعد المحاولة.'); }
    finally { setLoading(false); }
  }, [cursor, session, snapshot]);
  useEffect(() => { void load(false); }, [snapshot?.workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Screen refreshing={loading && items.length > 0} onRefresh={() => void load(false)}><PageHeader eyebrow="سجل التنفيذ" title="العمليات" subtitle="لا يظهر نجاح قبل تأكيد النظام ثم مزامنة مَدار" />{loading && !items.length ? [1, 2, 3].map((item) => <Skeleton key={item} height={110} />) : items.length ? items.map((item) => <Card key={item.id}><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}><Text selectable style={{ flex: 1, color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.label}</Text><Badge label={statusLabel[item.status] || item.status} tone={tone(item.status)} /></View><Text selectable style={{ color: colors.faint, fontSize: 11, textAlign: 'right' }}>{dateTime(item.updatedAt)}</Text>{item.message ? <Text selectable style={{ color: colors.muted, lineHeight: 21, textAlign: 'right' }}>{item.message}</Text> : null}</Card>) : <EmptyState title="لا توجد عمليات بعد" body="عند تنفيذ أمر آمن من التطبيق سيظهر مساره وحالته هنا." />}{hasMore ? <AppButton kind="secondary" label="تحميل المزيد" loading={loading} onPress={() => void load(true)} /> : null}</Screen>;
}
