import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { askOrby, fetchDashboard } from '@/lib/api';
import { clearDashboardCache, readDashboardCache, writeDashboardCache } from '@/lib/cache';
import { colors } from '@/theme';
import type { DashboardAlert, DashboardSnapshot, OrbyMessage, OrbyMode } from '@/types';

I18nManager.allowRTL(true);

type Tab = 'home' | 'reports' | 'orby' | 'account';

const money = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('ar-YE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value).toLocaleString('ar-YE')} ${currency}`;
  }
};

const dateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString('ar-YE', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!authReady) return <LoadingScreen label="جارٍ استعادة جلسة مَدار…" />;
  if (!session) return <LoginScreen />;
  return <AuthenticatedApp session={session} />;
}

function AuthenticatedApp({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('home');
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const fresh = await fetchDashboard(session.access_token);
      setSnapshot(fresh);
      setOffline(false);
      await writeDashboardCache(fresh);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'تعذر تحميل لوحة العمل.';
      const cached = snapshot || await readDashboardCache();
      if (cached) {
        setSnapshot(cached);
        setOffline(true);
        setError('تعذر التحديث، وتُعرض آخر نسخة محفوظة على الجهاز.');
      } else {
        setError(message);
      }
      if (message.includes('الجلسة')) await supabase.auth.signOut();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.access_token, snapshot]);

  useEffect(() => {
    readDashboardCache().then((cached) => {
      if (cached) setSnapshot(cached);
      load();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !snapshot) return <LoadingScreen label="جارٍ تجهيز مركز القيادة…" />;

  if (!snapshot) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <View style={styles.centered}>
          <BrandMark />
          <Text style={styles.errorTitle}>لم نتمكن من فتح لوحة العمل</Text>
          <Text style={styles.errorBody}>{error || 'تحقق من اتصال الإنترنت ثم أعد المحاولة.'}</Text>
          <PrimaryButton label="إعادة المحاولة" onPress={() => load()} />
          <GhostButton label="تسجيل الخروج" onPress={() => supabase.auth.signOut()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.app}>
        {tab === 'home' && (
          <HomeScreen snapshot={snapshot} refreshing={refreshing} onRefresh={() => load(true)} offline={offline} error={error} />
        )}
        {tab === 'reports' && (
          <ReportsScreen snapshot={snapshot} refreshing={refreshing} onRefresh={() => load(true)} />
        )}
        {tab === 'orby' && <OrbyScreen session={session} snapshot={snapshot} />}
        {tab === 'account' && <AccountScreen session={session} snapshot={snapshot} />}
        <BottomNav active={tab} onChange={setTab} attention={snapshot.alerts.some((item) => item.severity === 'critical' || item.severity === 'warning')} />
      </View>
    </SafeAreaView>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError('بيانات الدخول غير صحيحة أو أن الحساب غير مفعل.');
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
          <BrandMark large />
          <Text style={styles.loginTitle}>لوحة مَدار على هاتفك</Text>
          <Text style={styles.loginBody}>اطّلع على حالة تجارتك، المؤشرات والتنبيهات الذكية دون أدوات تعديل أو صلاحيات حساسة.</Text>
          <View style={styles.loginCard}>
            <FieldLabel>البريد الإلكتروني</FieldLabel>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="name@example.com"
              placeholderTextColor={colors.faint}
              style={styles.input}
              textAlign="right"
            />
            <FieldLabel>كلمة المرور</FieldLabel>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholder="••••••••"
              placeholderTextColor={colors.faint}
              style={styles.input}
              textAlign="right"
              onSubmitEditing={signIn}
            />
            {error && <Text style={styles.inlineError}>{error}</Text>}
            <PrimaryButton label={loading ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'} onPress={signIn} disabled={loading} />
          </View>
          <Text style={styles.securityNote}>تُحفظ الجلسة محليًا وتُطبق صلاحيات مساحة العمل نفسها الموجودة في منصة مَدار.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HomeScreen({ snapshot, refreshing, onRefresh, offline, error }: {
  snapshot: DashboardSnapshot;
  refreshing: boolean;
  onRefresh: () => void;
  offline: boolean;
  error: string | null;
}) {
  const { summary, workspace } = snapshot;
  const greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  const needsAttention = snapshot.status === 'attention';

  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.screenHeader}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>{greeting}</Text>
          <Text style={styles.title}>{snapshot.profile.fullName || 'عميل مَدار'}</Text>
          <Text style={styles.subtitle}>{workspace.name}</Text>
        </View>
        <BrandMark />
      </View>

      {(offline || error) && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{error || 'أنت في وضع العرض المحفوظ.'}</Text>
        </View>
      )}

      <View style={[styles.commandCard, needsAttention ? styles.commandAttention : styles.commandHealthy]}>
        <View style={styles.commandIcon}><Text style={styles.commandIconText}>{needsAttention ? '!' : '✓'}</Text></View>
        <View style={styles.commandCopy}>
          <Text style={styles.commandLabel}>حالة العمل الآن</Text>
          <Text style={styles.commandTitle}>{needsAttention ? `${snapshot.alerts.length} أمور تستحق انتباهك` : 'كل شيء يبدو مستقرًا'}</Text>
          <Text style={styles.commandBody}>{needsAttention ? 'رتّب أوربي التنبيهات حسب الأولوية لتعرف ما الذي تراجعه أولًا.' : 'لا توجد تنبيهات حرجة في البيانات المتاحة حاليًا.'}</Text>
        </View>
      </View>

      <SectionTitle title="المؤشرات السريعة" hint="آخر 30 يومًا" />
      <View style={styles.metricsGrid}>
        <MetricCard label="المبيعات" value={money(summary.revenue30d, workspace.currency)} accent="mint" />
        <MetricCard label="صافي تقريبي" value={money(summary.profit30d, workspace.currency)} accent={summary.profit30d >= 0 ? 'violet' : 'red'} />
        <MetricCard label="مبيعات اليوم" value={money(summary.todayRevenue, workspace.currency)} accent="sky" />
        <MetricCard label="العملاء" value={String(summary.customers)} accent="violet" />
        <MetricCard label="تنبيهات المخزون" value={String(summary.lowStock)} accent={summary.lowStock ? 'amber' : 'mint'} />
        <MetricCard label="المهام المفتوحة" value={String(summary.openTasks)} accent="amber" />
      </View>

      <SectionTitle title="ما يستحق انتباهك" hint={`${snapshot.alerts.length} تنبيه`} />
      <View style={styles.stack}>
        {snapshot.alerts.length ? snapshot.alerts.slice(0, 6).map((alert) => <AlertCard key={alert.id} alert={alert} />) : <EmptyCard text="لا توجد تنبيهات نشطة الآن." />}
      </View>

      <SectionTitle title="المهام الأقرب" hint="عرض فقط" />
      <View style={styles.stack}>
        {snapshot.tasks.length ? snapshot.tasks.map((task) => (
          <View key={task.id} style={styles.listCard}>
            <View style={styles.listMain}>
              <Text style={styles.listTitle}>{task.title}</Text>
              <Text style={styles.listMeta}>{task.dueAt ? dateTime(task.dueAt) : 'بلا موعد محدد'}</Text>
            </View>
            <Pill text={priorityLabel(task.priority)} tone={task.priority === 'urgent' || task.priority === 'high' ? 'danger' : 'neutral'} />
          </View>
        )) : <EmptyCard text="لا توجد مهام مفتوحة." />}
      </View>

      <Text style={styles.lastUpdate}>آخر تحديث: {dateTime(snapshot.fetchedAt)}</Text>
    </ScreenScroll>
  );
}

function ReportsScreen({ snapshot, refreshing, onRefresh }: { snapshot: DashboardSnapshot; refreshing: boolean; onRefresh: () => void }) {
  const maxValue = Math.max(1, ...snapshot.dailySeries.flatMap((item) => [item.revenue, item.expenses]));
  const { currency } = snapshot.workspace;
  return (
    <ScreenScroll refreshing={refreshing} onRefresh={onRefresh}>
      <PageHeader eyebrow="التقارير" title="الأداء المالي" subtitle="قراءة مختصرة من بيانات مساحة العمل" />
      <View style={styles.reportHero}>
        <Text style={styles.reportHeroLabel}>صافي آخر 30 يومًا</Text>
        <Text style={[styles.reportHeroValue, snapshot.summary.profit30d < 0 && styles.negative]}>{money(snapshot.summary.profit30d, currency)}</Text>
        <View style={styles.reportSplit}>
          <MiniValue label="الإيرادات" value={money(snapshot.summary.revenue30d, currency)} />
          <MiniValue label="المصروفات" value={money(snapshot.summary.expenses30d, currency)} />
        </View>
      </View>

      <SectionTitle title="آخر 7 أيام" hint="مبيعات ومصروفات" />
      <View style={styles.chartCard}>
        <View style={styles.legendRow}>
          <LegendDot label="المبيعات" color={colors.mint} />
          <LegendDot label="المصروفات" color={colors.violet} />
        </View>
        <View style={styles.chartRows}>
          {snapshot.dailySeries.map((point) => (
            <View key={point.date} style={styles.chartRow}>
              <Text style={styles.chartLabel}>{point.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, styles.revenueBar, { width: `${Math.max(2, (point.revenue / maxValue) * 100)}%` }]} />
                <View style={[styles.bar, styles.expenseBar, { width: `${Math.max(2, (point.expenses / maxValue) * 100)}%` }]} />
              </View>
              <Text style={styles.chartNumber}>{Math.round(point.revenue).toLocaleString('ar-YE')}</Text>
            </View>
          ))}
        </View>
      </View>

      <SectionTitle title="آخر المبيعات" hint={`${snapshot.recentSales.length} عمليات`} />
      <View style={styles.stack}>
        {snapshot.recentSales.length ? snapshot.recentSales.map((sale) => (
          <View key={sale.id} style={styles.listCard}>
            <View style={styles.listMain}>
              <Text style={styles.listTitle}>عملية بيع</Text>
              <Text style={styles.listMeta}>{dateTime(sale.soldAt)}</Text>
            </View>
            <Text style={styles.saleValue}>{money(sale.total, currency)}</Text>
          </View>
        )) : <EmptyCard text="لا توجد مبيعات مسجلة في الفترة المعروضة." />}
      </View>
    </ScreenScroll>
  );
}

function OrbyScreen({ session, snapshot }: { session: Session; snapshot: DashboardSnapshot }) {
  const [mode, setMode] = useState<OrbyMode>('GENERAL');
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<OrbyMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function send() {
    const text = prompt.trim();
    if (text.length < 5 || sending) return;
    const userMessage: OrbyMessage = { id: `user-${Date.now()}`, role: 'user', text };
    setMessages((current) => [...current, userMessage]);
    setPrompt('');
    setSending(true);
    try {
      const reply = await askOrby(session.access_token, {
        organizationId: snapshot.workspace.id,
        conversationId,
        mode,
        prompt: text,
      });
      setConversationId(reply.conversationId);
      setRemaining(reply.remaining);
      setMessages((current) => [...current, { id: `orby-${Date.now()}`, role: 'assistant', text: reply.text, source: reply.source }]);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'تعذر تشغيل أوربي.';
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', text: message, source: 'smart-fallback' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
        <PageHeader eyebrow="المساعد الذكي" title="أوربي" subtitle="يسأل بيانات مَدار ويقدّم تفسيرًا وخطوة تالية" />
        <View style={styles.orbyStatus}>
          <View style={styles.orbyOrb}><Text style={styles.orbyOrbText}>O</Text></View>
          <View style={styles.orbyStatusCopy}>
            <Text style={styles.orbyStatusTitle}>متصل بمساحة {snapshot.workspace.name}</Text>
            <Text style={styles.orbyStatusBody}>لا يملك التطبيق أدوات تعديل، وأي إجابة مبنية على صلاحيات حسابك فقط.</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRow}>
          {(['GENERAL', 'SALES', 'INVENTORY', 'CUSTOMERS', 'PLANNING'] as OrbyMode[]).map((item) => (
            <Pressable key={item} onPress={() => setMode(item)} style={[styles.modeChip, mode === item && styles.modeChipActive]}>
              <Text style={[styles.modeChipText, mode === item && styles.modeChipTextActive]}>{modeLabel(item)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.chatArea}>
          {!messages.length && (
            <View style={styles.promptIdeas}>
              <Text style={styles.promptIdeasTitle}>ابدأ بسؤال مثل:</Text>
              {['كيف كان أداء المبيعات هذا الأسبوع؟', 'ما الذي يستحق انتباهي في المخزون؟', 'اقترح أولوياتي لليوم.'].map((idea) => (
                <Pressable key={idea} style={styles.ideaButton} onPress={() => setPrompt(idea)}>
                  <Text style={styles.ideaText}>{idea}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {messages.map((message) => (
            <View key={message.id} style={[styles.message, message.role === 'user' ? styles.userMessage : styles.orbyMessage]}>
              <Text style={styles.messageRole}>{message.role === 'user' ? 'أنت' : 'أوربي'}</Text>
              <Text style={styles.messageText}>{message.text}</Text>
              {message.source === 'smart-fallback' && <Text style={styles.fallbackLabel}>تحليل احتياطي آمن</Text>}
            </View>
          ))}
          {sending && <View style={[styles.message, styles.orbyMessage]}><ActivityIndicator color={colors.mint} /></View>}
        </View>

        <View style={styles.composer}>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="اسأل أوربي عن تجارتك…"
            placeholderTextColor={colors.faint}
            style={styles.composerInput}
            multiline
            textAlign="right"
          />
          <Pressable onPress={send} disabled={sending || prompt.trim().length < 5} style={({ pressed }) => [styles.sendButton, (sending || prompt.trim().length < 5) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.sendButtonText}>إرسال</Text>
          </Pressable>
        </View>
        {remaining !== null && <Text style={styles.remaining}>المتبقي اليوم: {remaining} طلبًا</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AccountScreen({ session, snapshot }: { session: Session; snapshot: DashboardSnapshot }) {
  async function signOut() {
    await clearDashboardCache();
    await supabase.auth.signOut();
  }
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <PageHeader eyebrow="الحساب" title={snapshot.profile.fullName || 'حساب مَدار'} subtitle={snapshot.profile.email || session.user.email || ''} />
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(snapshot.profile.fullName || snapshot.profile.email || 'م').trim().charAt(0)}</Text></View>
        <Text style={styles.profileName}>{snapshot.profile.fullName || 'عميل مَدار'}</Text>
        <Text style={styles.profileEmail}>{snapshot.profile.email || session.user.email}</Text>
      </View>
      <SectionTitle title="مساحة العمل" />
      <InfoRow label="الاسم" value={snapshot.workspace.name} />
      <InfoRow label="النوع" value={workspaceType(snapshot.workspace.type)} />
      <InfoRow label="الصلاحية" value={roleLabel(snapshot.workspace.role)} />
      <InfoRow label="حالة المساحة" value={snapshot.workspace.status === 'active' ? 'نشطة' : snapshot.workspace.status} />
      <InfoRow label="الاشتراك" value={subscriptionLabel(snapshot.subscriptionStatus)} />
      <View style={styles.readOnlyCard}>
        <Text style={styles.readOnlyTitle}>تطبيق عرض آمن</Text>
        <Text style={styles.readOnlyBody}>لا يتضمن هذا التطبيق إنشاء منتجات أو تعديل مخزون أو إدارة مستخدمين. تتم العمليات الإدارية من منصة الويب فقط.</Text>
      </View>
      <GhostButton label="تسجيل الخروج" onPress={() => Alert.alert('تسجيل الخروج', 'هل تريد إنهاء الجلسة على هذا الجهاز؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الخروج', style: 'destructive', onPress: signOut },
      ])} />
    </ScrollView>
  );
}

function BottomNav({ active, onChange, attention }: { active: Tab; onChange: (tab: Tab) => void; attention: boolean }) {
  const items: Array<{ key: Tab; icon: string; label: string }> = [
    { key: 'home', icon: '⌂', label: 'الرئيسية' },
    { key: 'reports', icon: '▥', label: 'التقارير' },
    { key: 'orby', icon: '✦', label: 'أوربي' },
    { key: 'account', icon: '●', label: 'الحساب' },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.navItem}>
          <View style={[styles.navIconWrap, active === item.key && styles.navIconWrapActive]}>
            <Text style={[styles.navIcon, active === item.key && styles.navIconActive]}>{item.icon}</Text>
            {item.key === 'home' && attention && <View style={styles.attentionDot} />}
          </View>
          <Text style={[styles.navLabel, active === item.key && styles.navLabelActive]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ScreenScroll({ children, refreshing, onRefresh }: { children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mint} colors={[colors.mint, colors.violet]} />}
    >
      {children}
    </ScrollView>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.centered}>
        <BrandMark large />
        <ActivityIndicator color={colors.mint} size="large" />
        <Text style={styles.loadingLabel}>{label}</Text>
      </View>
    </SafeAreaView>
  );
}

function BrandMark({ large = false }: { large?: boolean }) {
  return (
    <View style={[styles.brandMark, large && styles.brandMarkLarge]}>
      <View style={[styles.orbitArc, styles.orbitMint]} />
      <View style={[styles.orbitArc, styles.orbitViolet]} />
      {large && <Text style={styles.brandWord}>مَدار</Text>}
    </View>
  );
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <View style={styles.pageHeader}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint && <Text style={styles.sectionHint}>{hint}</Text>}
    </View>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: 'mint' | 'violet' | 'amber' | 'red' | 'sky' }) {
  const accentStyle = {
    mint: styles.metricMint,
    violet: styles.metricViolet,
    amber: styles.metricAmber,
    red: styles.metricRed,
    sky: styles.metricSky,
  }[accent];
  return (
    <View style={[styles.metricCard, accentStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function AlertCard({ alert }: { alert: DashboardAlert }) {
  const tone = {
    critical: styles.alertCritical,
    warning: styles.alertWarning,
    info: styles.alertInfo,
    success: styles.alertSuccess,
  }[alert.severity];
  return (
    <View style={[styles.alertCard, tone]}>
      <Text style={styles.alertTitle}>{alert.title}</Text>
      <Text style={styles.alertBody}>{alert.body}</Text>
      <Text style={styles.alertTime}>{dateTime(alert.generatedAt)}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <View style={styles.emptyCard}><Text style={styles.emptyText}>{text}</Text></View>;
}

function Pill({ text, tone }: { text: string; tone: 'danger' | 'neutral' }) {
  return <View style={[styles.pill, tone === 'danger' && styles.pillDanger]}><Text style={[styles.pillText, tone === 'danger' && styles.pillDangerText]}>{text}</Text></View>;
}

function MiniValue({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniValue}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniNumber}>{value}</Text></View>;
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
      <Text style={styles.ghostButtonText}>{label}</Text>
    </Pressable>
  );
}

const priorityLabel = (value: string) => ({ low: 'منخفضة', medium: 'متوسطة', high: 'عالية', urgent: 'عاجلة' }[value] || value);
const modeLabel = (value: OrbyMode) => ({ GENERAL: 'عام', SALES: 'المبيعات', INVENTORY: 'المخزون', CUSTOMERS: 'العملاء', PLANNING: 'التخطيط' }[value]);
const workspaceType = (value: string) => ({ INDIVIDUAL: 'فرد', MERCHANT: 'متجر', COMPANY: 'شركة', STUDENT: 'طالب' }[value] || value);
const roleLabel = (value: string) => ({ OWNER: 'المالك', ADMIN: 'مدير', MEMBER: 'عضو', VIEWER: 'مشاهد' }[value] || value);
const subscriptionLabel = (value: DashboardSnapshot['subscriptionStatus']) => ({ active: 'نشط', past_due: 'متأخر', expired: 'منتهي', cancelled: 'ملغي', missing: 'غير موجود' }[value]);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 116 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
  loadingLabel: { color: colors.muted, fontSize: 14, writingDirection: 'rtl' },
  brandMark: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  brandMarkLarge: { width: 106, height: 106, marginBottom: 4 },
  orbitArc: { position: 'absolute', width: '58%', height: '76%', borderWidth: 5, borderRadius: 999, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
  orbitMint: { borderLeftColor: colors.mint, borderRightColor: 'transparent', left: '10%', transform: [{ rotate: '8deg' }] },
  orbitViolet: { borderRightColor: colors.violet, borderLeftColor: 'transparent', right: '10%', transform: [{ rotate: '8deg' }] },
  brandWord: { position: 'absolute', bottom: -5, color: colors.text, fontSize: 15, fontWeight: '900' },
  loginContent: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 48, alignItems: 'center' },
  loginTitle: { color: colors.text, fontWeight: '900', fontSize: 28, textAlign: 'center', writingDirection: 'rtl' },
  loginBody: { color: colors.muted, fontSize: 14, lineHeight: 24, textAlign: 'center', marginTop: 10, maxWidth: 420, writingDirection: 'rtl' },
  loginCard: { width: '100%', maxWidth: 460, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 24, padding: 18, marginTop: 26 },
  fieldLabel: { color: colors.text, fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: 8, textAlign: 'right' },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated, color: colors.text, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, writingDirection: 'rtl' },
  inlineError: { color: colors.red, textAlign: 'right', marginTop: 12, lineHeight: 21, writingDirection: 'rtl' },
  securityNote: { color: colors.faint, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 18, maxWidth: 420, writingDirection: 'rtl' },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 20 },
  primaryButtonText: { color: '#06110F', fontWeight: '900', fontSize: 15 },
  ghostButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 20 },
  ghostButtonText: { color: colors.text, fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  errorTitle: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' },
  errorBody: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: 'center', writingDirection: 'rtl' },
  screenHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headerTextWrap: { flex: 1, alignItems: 'flex-start' },
  pageHeader: { marginBottom: 22, alignItems: 'flex-start' },
  eyebrow: { color: colors.mint, fontSize: 12, fontWeight: '900', writingDirection: 'rtl', textAlign: 'right' },
  title: { color: colors.text, fontSize: 27, fontWeight: '900', marginTop: 3, writingDirection: 'rtl', textAlign: 'right' },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4, writingDirection: 'rtl', textAlign: 'right' },
  offlineBanner: { backgroundColor: colors.amberSoft, borderWidth: 1, borderColor: 'rgba(247,200,115,.25)', padding: 12, borderRadius: 14, marginTop: 16 },
  offlineText: { color: colors.amber, fontSize: 12, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  commandCard: { borderRadius: 24, borderWidth: 1, padding: 18, marginTop: 20, flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  commandHealthy: { backgroundColor: colors.mintSoft, borderColor: 'rgba(112,228,212,.25)' },
  commandAttention: { backgroundColor: colors.amberSoft, borderColor: 'rgba(247,200,115,.25)' },
  commandIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(0,0,0,.22)', alignItems: 'center', justifyContent: 'center' },
  commandIconText: { color: colors.text, fontSize: 24, fontWeight: '900' },
  commandCopy: { flex: 1, alignItems: 'flex-start' },
  commandLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  commandTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2, writingDirection: 'rtl', textAlign: 'right' },
  commandBody: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 5, writingDirection: 'rtl', textAlign: 'right' },
  sectionTitleRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '900', writingDirection: 'rtl' },
  sectionHint: { color: colors.faint, fontSize: 11, writingDirection: 'rtl' },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', marginHorizontal: -5 },
  metricCard: { width: '50%', padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, marginBottom: 10, transform: [{ scale: 0.97 }] },
  metricMint: { borderTopColor: colors.mint },
  metricViolet: { borderTopColor: colors.violet },
  metricAmber: { borderTopColor: colors.amber },
  metricRed: { borderTopColor: colors.red },
  metricSky: { borderTopColor: colors.sky },
  metricLabel: { color: colors.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  stack: { gap: 10 },
  alertCard: { borderRadius: 18, borderWidth: 1, padding: 15 },
  alertCritical: { backgroundColor: colors.redSoft, borderColor: 'rgba(251,113,133,.24)' },
  alertWarning: { backgroundColor: colors.amberSoft, borderColor: 'rgba(247,200,115,.24)' },
  alertInfo: { backgroundColor: colors.skySoft, borderColor: 'rgba(125,211,252,.22)' },
  alertSuccess: { backgroundColor: colors.mintSoft, borderColor: 'rgba(112,228,212,.22)' },
  alertTitle: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  alertBody: { color: colors.muted, fontSize: 12, lineHeight: 20, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  alertTime: { color: colors.faint, fontSize: 10, marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: 22, alignItems: 'center' },
  emptyText: { color: colors.faint, textAlign: 'center', writingDirection: 'rtl' },
  listCard: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  listMain: { flex: 1, alignItems: 'flex-start' },
  listTitle: { color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  listMeta: { color: colors.faint, fontSize: 10, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.violetSoft },
  pillText: { color: colors.violet, fontSize: 10, fontWeight: '800' },
  pillDanger: { backgroundColor: colors.redSoft },
  pillDangerText: { color: colors.red },
  lastUpdate: { color: colors.faint, fontSize: 10, textAlign: 'center', marginTop: 24, writingDirection: 'rtl' },
  reportHero: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(155,123,255,.25)', backgroundColor: colors.violetSoft, padding: 20 },
  reportHeroLabel: { color: colors.muted, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
  reportHeroValue: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  negative: { color: colors.red },
  reportSplit: { flexDirection: 'row-reverse', marginTop: 18, gap: 10 },
  miniValue: { flex: 1, borderRadius: 15, backgroundColor: 'rgba(0,0,0,.16)', padding: 12, alignItems: 'flex-start' },
  miniLabel: { color: colors.muted, fontSize: 10, writingDirection: 'rtl' },
  miniNumber: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 4, writingDirection: 'rtl' },
  chartCard: { borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 },
  legendRow: { flexDirection: 'row-reverse', gap: 16, marginBottom: 16 },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 99 },
  legendText: { color: colors.muted, fontSize: 10, writingDirection: 'rtl' },
  chartRows: { gap: 13 },
  chartRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  chartLabel: { width: 32, color: colors.muted, fontSize: 10, textAlign: 'right' },
  barTrack: { flex: 1, height: 20, justifyContent: 'center', gap: 3 },
  bar: { height: 5, borderRadius: 99 },
  revenueBar: { backgroundColor: colors.mint },
  expenseBar: { backgroundColor: colors.violet },
  chartNumber: { width: 58, color: colors.faint, fontSize: 9, textAlign: 'left' },
  saleValue: { color: colors.mint, fontSize: 13, fontWeight: '900', writingDirection: 'rtl' },
  orbyStatus: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(112,228,212,.22)', backgroundColor: colors.mintSoft, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  orbyOrb: { width: 52, height: 52, borderRadius: 18, borderWidth: 2, borderColor: colors.violet, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  orbyOrbText: { color: colors.mint, fontSize: 22, fontWeight: '900' },
  orbyStatusCopy: { flex: 1, alignItems: 'flex-start' },
  orbyStatusTitle: { color: colors.text, fontSize: 13, fontWeight: '900', writingDirection: 'rtl', textAlign: 'right' },
  orbyStatusBody: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 4, writingDirection: 'rtl', textAlign: 'right' },
  modeRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 16 },
  modeChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  modeChipActive: { borderColor: colors.mint, backgroundColor: colors.mintSoft },
  modeChipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  modeChipTextActive: { color: colors.mint },
  chatArea: { gap: 10, minHeight: 260 },
  promptIdeas: { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: 14 },
  promptIdeasTitle: { color: colors.muted, fontSize: 11, textAlign: 'right', marginBottom: 10, writingDirection: 'rtl' },
  ideaButton: { backgroundColor: colors.surfaceElevated, borderRadius: 12, padding: 12, marginTop: 7 },
  ideaText: { color: colors.text, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
  message: { maxWidth: '90%', borderRadius: 18, padding: 14 },
  userMessage: { alignSelf: 'flex-end', backgroundColor: colors.violetSoft, borderWidth: 1, borderColor: 'rgba(155,123,255,.22)' },
  orbyMessage: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  messageRole: { color: colors.mint, fontSize: 10, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  messageText: { color: colors.text, fontSize: 13, lineHeight: 22, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  fallbackLabel: { color: colors.amber, fontSize: 9, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  composer: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 9, marginTop: 18 },
  composerInput: { flex: 1, minHeight: 50, maxHeight: 130, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, writingDirection: 'rtl' },
  sendButton: { minHeight: 50, borderRadius: 15, backgroundColor: colors.mint, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  sendButtonText: { color: '#06110F', fontWeight: '900', fontSize: 12 },
  remaining: { color: colors.faint, fontSize: 10, marginTop: 10, textAlign: 'right', writingDirection: 'rtl' },
  profileCard: { alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 22 },
  avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.violetSoft, borderWidth: 1, borderColor: 'rgba(155,123,255,.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.violet, fontSize: 30, fontWeight: '900' },
  profileName: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 12, writingDirection: 'rtl' },
  profileEmail: { color: colors.muted, fontSize: 12, marginTop: 4 },
  infoRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 15, flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 12 },
  infoLabel: { color: colors.muted, fontSize: 12, writingDirection: 'rtl' },
  infoValue: { color: colors.text, fontSize: 12, fontWeight: '800', writingDirection: 'rtl', textAlign: 'left' },
  readOnlyCard: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(125,211,252,.22)', backgroundColor: colors.skySoft, padding: 15, marginTop: 24 },
  readOnlyTitle: { color: colors.sky, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  readOnlyBody: { color: colors.muted, fontSize: 11, lineHeight: 19, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  bottomNav: { position: 'absolute', left: 12, right: 12, bottom: Platform.OS === 'ios' ? 14 : 10, height: 74, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(17,21,29,.98)', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navIconWrap: { width: 34, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: colors.mintSoft },
  navIcon: { color: colors.faint, fontSize: 18, fontWeight: '900' },
  navIconActive: { color: colors.mint },
  navLabel: { color: colors.faint, fontSize: 9, fontWeight: '700', writingDirection: 'rtl' },
  navLabelActive: { color: colors.text },
  attentionDot: { position: 'absolute', width: 6, height: 6, borderRadius: 99, backgroundColor: colors.red, top: 2, right: 4 },
});
