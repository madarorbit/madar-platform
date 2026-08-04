import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { tokens, useMadarTheme } from '@/providers/theme-provider';

export function Card({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  const { colors } = useMadarTheme();
  return <View style={{ gap, padding: 16, borderRadius: tokens.radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{children}</View>;
}

export function AppButton({ label, loading, kind = 'primary', disabled, ...props }: PressableProps & { label: string; loading?: boolean; kind?: 'primary' | 'secondary' | 'danger' }) {
  const { colors } = useMadarTheme();
  const backgroundColor = kind === 'primary' ? colors.mint : kind === 'danger' ? colors.redSoft : colors.elevated;
  const color = kind === 'primary' ? '#07120F' : kind === 'danger' ? colors.red : colors.text;
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} {...props} style={({ pressed }) => ({ opacity: disabled || loading ? 0.5 : pressed ? 0.78 : 1, minHeight: 48, paddingHorizontal: 16, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor })}>
      {loading ? <ActivityIndicator color={color} /> : <Text selectable style={{ color, fontSize: 14, fontWeight: '900' }}>{label}</Text>}
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'info' }) {
  const { colors } = useMadarTheme();
  const color = tone === 'good' ? colors.mint : tone === 'warn' ? colors.amber : tone === 'danger' ? colors.red : tone === 'info' ? colors.sky : colors.muted;
  const backgroundColor = tone === 'good' ? colors.mintSoft : tone === 'warn' ? colors.amberSoft : tone === 'danger' ? colors.redSoft : tone === 'info' ? colors.skySoft : colors.elevated;
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor }}><Text selectable style={{ color, fontSize: 11, fontWeight: '800' }}>{label}</Text></View>;
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { colors } = useMadarTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, gap: 7, padding: 14, minHeight: 105, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Text selectable style={{ color: colors.muted, fontSize: 12, textAlign: 'right' }}>{label}</Text>
      <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right', fontVariant: ['tabular-nums'] }}>{value}</Text>
      {hint ? <Text selectable style={{ color: colors.faint, fontSize: 10, textAlign: 'right' }}>{hint}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  const { colors } = useMadarTheme();
  return <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'right' }}>{title}</Text>{hint ? <Text selectable style={{ color: colors.faint, fontSize: 11 }}>{hint}</Text> : null}</View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const { colors } = useMadarTheme();
  return <Card><Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'right' }}>{title}</Text><Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'right' }}>{body}</Text></Card>;
}

export function Skeleton({ height = 96 }: { height?: number }) {
  const { colors } = useMadarTheme();
  return <View style={{ height, borderRadius: 18, backgroundColor: colors.elevated, opacity: 0.7 }} />;
}
