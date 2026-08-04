import { Text, View } from 'react-native';
import { PageHeader, Screen } from '@/components/screen';
import { Card, EmptyState, MetricCard, SectionTitle, Skeleton } from '@/components/ui';
import { useMadarApp } from '@/providers/app-provider';
import { useMadarTheme } from '@/providers/theme-provider';

const money = (value: number, currency: string) => {
  try { return new Intl.NumberFormat('ar-YE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${Math.round(value).toLocaleString('ar-YE')} ${currency}`; }
};
export default function ReportsScreen() {
  const { snapshot, loading, refreshing, refresh } = useMadarApp();
  const { colors } = useMadarTheme();
  if (loading && !snapshot) return <Screen><Skeleton height={140} /><Skeleton height={260} /></Screen>;
  if (!snapshot) return <Screen><EmptyState title="لا توجد بيانات تقارير" body="أعد التحديث بعد اكتمال ربط مساحة العمل." /></Screen>;
  const max = Math.max(1, ...snapshot.dailySeries.flatMap((point) => [point.revenue, point.expenses]));
  return <Screen refreshing={refreshing} onRefresh={() => void refresh()}><PageHeader eyebrow="التقارير" title="الأداء المالي" subtitle="قراءة مركزة دون ازدحام أدوات منصة الويب" /><View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}><MetricCard label="إيراد 30 يومًا" value={money(snapshot.summary.revenue30d, snapshot.workspace.currency)} /><MetricCard label="المصروفات" value={money(snapshot.summary.expenses30d, snapshot.workspace.currency)} /><MetricCard label="الصافي" value={money(snapshot.summary.profit30d, snapshot.workspace.currency)} /><MetricCard label="مبيعات اليوم" value={money(snapshot.summary.todayRevenue, snapshot.workspace.currency)} /></View><SectionTitle title="آخر 7 أيام" hint="مبيعات / مصروفات" /><Card><View style={{ height: 220, flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8 }}>{snapshot.dailySeries.map((point) => <View key={point.date} style={{ flex: 1, alignItems: 'center', gap: 7 }}><View style={{ height: 170, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3 }}><View style={{ width: '38%', minHeight: 3, height: `${Math.max(2, point.revenue / max * 100)}%`, borderRadius: 8, backgroundColor: colors.mint }} /><View style={{ width: '38%', minHeight: 3, height: `${Math.max(2, point.expenses / max * 100)}%`, borderRadius: 8, backgroundColor: colors.violet }} /></View><Text selectable style={{ color: colors.faint, fontSize: 10 }}>{point.label}</Text></View>)}</View></Card></Screen>;
}
