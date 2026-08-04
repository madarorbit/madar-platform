import { Text, View } from 'react-native';
import { Brand } from '@/components/brand';
import { PageHeader, Screen } from '@/components/screen';
import { Badge, Card, EmptyState, MetricCard, SectionTitle, Skeleton } from '@/components/ui';
import { useMadarApp } from '@/providers/app-provider';
import { useMadarTheme } from '@/providers/theme-provider';

const number = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) { const value = Number(record[key]); if (Number.isFinite(value)) return value; }
  return 0;
};
const money = (value: number, currency: string) => {
  try { return new Intl.NumberFormat('ar-YE', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${Math.round(value).toLocaleString('ar-YE')} ${currency}`; }
};
const dateTime = (value: string) => new Date(value).toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' });

export default function DashboardScreen() {
  const { snapshot, loading, refreshing, refresh, stale, online, error } = useMadarApp();
  const { colors } = useMadarTheme();
  if (loading && !snapshot) return <Screen>{[1, 2, 3, 4].map((item) => <Skeleton key={item} height={item === 1 ? 130 : 100} />)}</Screen>;
  if (!snapshot) return <Screen contentContainerStyle={{ justifyContent: 'center' }}><EmptyState title="لم نتمكن من فتح لوحة القيادة" body={error || 'تحقق من الاتصال ثم اسحب للتحديث.'} /></Screen>;
  const sector = snapshot.summary.sector || {};
  const currency = snapshot.workspace.currency;
  const metrics = snapshot.vertical.extension === 'food_service'
    ? [
        ['الطلبات المفتوحة', String(number(sector, 'open_orders', 'openOrders'))], ['حالة المطبخ', String(number(sector, 'kitchen_pending', 'kitchenPending'))],
        ['مبيعات اليوم', money(snapshot.summary.todayRevenue, currency)], ['المكونات الناقصة', String(number(sector, 'missing_ingredients', 'missingIngredients', 'low_stock_items'))],
        ['الطاولات النشطة', String(number(sector, 'active_tables', 'occupied_tables'))], ['الهدر', money(number(sector, 'waste_cost', 'wasteCost'), currency)],
      ]
    : snapshot.vertical.extension === 'hospitality'
      ? [
          ['الإشغال', `${number(sector, 'occupancy_rate', 'occupancyRate')}%`], ['الوصول اليوم', String(number(sector, 'arrivals_today', 'arrivalsToday'))],
          ['المغادرة اليوم', String(number(sector, 'departures_today', 'departuresToday'))], ['الغرف غير الجاهزة', String(number(sector, 'dirty_rooms', 'rooms_not_ready'))],
          ['الحجوزات', String(number(sector, 'reservations', 'active_reservations'))], ['الصيانة', String(number(sector, 'maintenance_open', 'open_maintenance'))],
        ]
      : [
          ['المبيعات', money(snapshot.summary.revenue30d, currency)], ['المشتريات', money(number(sector, 'purchases_total', 'purchase_total'), currency)],
          ['المخزون', String(snapshot.summary.products)], ['العملاء الآجلون', String(number(sector, 'credit_customers', 'receivables_count'))],
          ['تنبيهات المخزون', String(snapshot.summary.lowStock)], ['صافي 30 يومًا', money(snapshot.summary.profit30d, currency)],
        ];
  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      <PageHeader eyebrow={snapshot.vertical.name} title={`مرحبًا، ${snapshot.profile.fullName || 'عميل مَدار'}`} subtitle={`${snapshot.workspace.operatingMode === 'MADAR_NATIVE' ? 'تشغيل داخل مَدار' : 'نظام خارجي مرتبط'} · ${snapshot.workspace.role}`} right={<Brand compact />} />
      {(stale || error) && <Card><Badge label={!online ? 'Offline' : 'تحديث متأخر'} tone="warn" /><Text selectable style={{ color: colors.amber, textAlign: 'right', lineHeight: 21 }}>{error || 'هذه آخر نسخة صالحة، وليست بيانات لحظية حتى تكتمل المزامنة.'}</Text></Card>}
      <Card><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 5 }}><Text selectable style={{ color: colors.muted, fontSize: 12, textAlign: 'right' }}>حالة العمل الآن</Text><Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'right' }}>{snapshot.status === 'attention' ? 'توجد أمور تحتاج انتباهك' : 'العمل مستقر وفق البيانات المتاحة'}</Text></View><Badge label={snapshot.sync.connectorState === 'connected' || snapshot.sync.connectorState === 'not_required' ? 'متصل' : 'تحقق من الربط'} tone={snapshot.sync.connectorState === 'connected' || snapshot.sync.connectorState === 'not_required' ? 'good' : 'warn'} /></View><Text selectable style={{ color: colors.faint, fontSize: 11, textAlign: 'right' }}>آخر مزامنة: {dateTime(snapshot.sync.lastSyncedAt)}</Text></Card>
      <SectionTitle title="المؤشرات ذات الأولوية" hint={snapshot.vertical.name} />
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>{metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} />)}</View>
      <SectionTitle title="أهم التنبيهات" hint={`${snapshot.alerts.length}`} />
      {snapshot.alerts.length ? snapshot.alerts.slice(0, 4).map((alert) => <Card key={alert.id}><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}><Text selectable style={{ flex: 1, color: colors.text, fontWeight: '900', textAlign: 'right' }}>{alert.title}</Text><Badge label={alert.severity === 'critical' ? 'حرج' : alert.severity === 'warning' ? 'تنبيه' : 'معلومة'} tone={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warn' : 'info'} /></View><Text selectable style={{ color: colors.muted, lineHeight: 21, textAlign: 'right' }}>{alert.body}</Text></Card>) : <EmptyState title="لا توجد تنبيهات نشطة" body="سيظهر هنا أي خطر أو فرصة تستحق انتباهك." />}
      <SectionTitle title="المهام الأقرب" hint={`${snapshot.tasks.length}`} />
      {snapshot.tasks.length ? snapshot.tasks.map((task) => <Card key={task.id}><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 }}><View style={{ flex: 1 }}><Text selectable style={{ color: colors.text, fontWeight: '800', textAlign: 'right' }}>{task.title}</Text><Text selectable style={{ color: colors.faint, fontSize: 11, textAlign: 'right' }}>{task.dueAt ? dateTime(task.dueAt) : 'بلا موعد محدد'}</Text></View><Badge label={task.priority} tone={task.priority === 'urgent' || task.priority === 'high' ? 'danger' : 'neutral'} /></View></Card>) : <EmptyState title="لا توجد مهام مفتوحة" body="يمكن إنشاء متابعة من التنبيهات أو من أوربي." />}
    </Screen>
  );
}
