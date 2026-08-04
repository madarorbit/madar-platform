import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import type { MobileAlert, MobileCommandAction } from '@madar/contracts/mobile-v2';
import { PageHeader, Screen } from '@/components/screen';
import { AppButton, Badge, Card, EmptyState, Skeleton } from '@/components/ui';
import { mobileApi } from '@/lib/api';
import { useMadarApp } from '@/providers/app-provider';
import { useAuth } from '@/providers/auth-provider';
import { useMadarTheme } from '@/providers/theme-provider';

export default function AlertsScreen() {
  const { session } = useAuth();
  const { snapshot, online } = useMadarApp();
  const { colors } = useMadarTheme();
  const [items, setItems] = useState<MobileAlert[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async (append = false) => {
    if (!session || !snapshot) return;
    setLoading(true);
    try {
      const page = await mobileApi.alerts(session.access_token, snapshot.workspace.id, append ? cursor : null);
      setItems((current) => append ? [...current, ...page.items] : page.items);
      setCursor(page.nextCursor); setHasMore(page.hasMore);
    } catch (error) { Alert.alert('تعذر تحميل التنبيهات', error instanceof Error ? error.message : 'أعد المحاولة.'); }
    finally { setLoading(false); }
  }, [cursor, session, snapshot]);
  useEffect(() => { void load(false); }, [snapshot?.workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(action: MobileCommandAction, target: MobileAlert) {
    if (!session || !snapshot) return;
    if (!online) return Alert.alert('لا يمكن التنفيذ دون اتصال', 'يُمنع تنفيذ الكتابة أثناء Offline.');
    setBusy(target.id);
    try {
      const input = { organizationId: snapshot.workspace.id, action, targetType: 'alert', targetId: target.id, payload: {}, idempotencyKey: Crypto.randomUUID() };
      const preview = await mobileApi.previewCommand(session.access_token, input);
      if (!preview.allowed || !preview.confirmationToken) throw new Error(preview.blockedReason || 'هذا الإجراء غير مسموح.');
      Alert.alert('تأكيد التنفيذ', `${preview.summary}${preview.warnings.length ? `\n\n${preview.warnings.join('\n')}` : ''}`, [
        { text: 'إلغاء', style: 'cancel', onPress: () => setBusy(null) },
        { text: 'تأكيد', onPress: async () => {
          try {
            const result = await mobileApi.confirmCommand(session.access_token, { ...input, confirmationToken: preview.confirmationToken! });
            Alert.alert(result.systemConfirmed ? 'تم التنفيذ' : 'يحتاج مراجعة', result.operation.message || (result.madarSynced ? 'تمت مزامنة مَدار.' : 'تم تسجيل العملية دون نجاح وهمي.'));
            await load(false);
          } catch (error) { Alert.alert('فشل التنفيذ', error instanceof Error ? error.message : 'تعذر تنفيذ الأمر.'); }
          finally { setBusy(null); }
        } },
      ]);
    } catch (error) { setBusy(null); Alert.alert('تعذر تجهيز المعاينة', error instanceof Error ? error.message : 'أعد المحاولة.'); }
  }

  return <Screen refreshing={loading && items.length > 0} onRefresh={() => void load(false)}><PageHeader eyebrow="الأولوية أولًا" title="التنبيهات" subtitle="إقرار القراءة أو إخفاء التنبيه فقط بعد معاينة وتأكيد" />{loading && !items.length ? [1, 2, 3].map((item) => <Skeleton key={item} height={130} />) : items.length ? items.map((item) => <Card key={item.id}><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}><Text selectable style={{ flex: 1, color: colors.text, fontWeight: '900', textAlign: 'right' }}>{item.title}</Text><Badge label={item.severity === 'critical' ? 'حرج' : item.severity === 'warning' ? 'تنبيه' : item.severity === 'success' ? 'مستقر' : 'معلومة'} tone={item.severity === 'critical' ? 'danger' : item.severity === 'warning' ? 'warn' : item.severity === 'success' ? 'good' : 'info'} /></View><Text selectable style={{ color: colors.muted, lineHeight: 22, textAlign: 'right' }}>{item.body}</Text><View style={{ flexDirection: 'row-reverse', gap: 8 }}><View style={{ flex: 1 }}><AppButton kind="secondary" label="تأكيد القراءة" loading={busy === item.id} onPress={() => void run('ALERT_ACKNOWLEDGE', item)} /></View><View style={{ flex: 1 }}><AppButton kind="secondary" label="إخفاء" disabled={busy === item.id} onPress={() => void run('ALERT_HIDE', item)} /></View></View></Card>) : <EmptyState title="لا توجد تنبيهات" body="ستظهر المخاطر والفرص الجديدة هنا عند اكتمال المزامنة." />}{hasMore ? <AppButton kind="secondary" label="تحميل المزيد" loading={loading} onPress={() => void load(true)} /> : null}</Screen>;
}
