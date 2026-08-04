import { RefreshControl, ScrollView, Text, View, type ScrollViewProps } from 'react-native';
import type { ReactNode } from 'react';
import { useMadarTheme } from '@/providers/theme-provider';

export function Screen({ children, refreshing = false, onRefresh, contentContainerStyle, ...props }: ScrollViewProps & { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  const { colors } = useMadarTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.mint} colors={[colors.mint]} /> : undefined}
      contentContainerStyle={[{ flexGrow: 1, gap: 18, padding: 16, paddingBottom: 34, backgroundColor: colors.background }, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  const { colors } = useMadarTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <Text selectable style={{ color: colors.mint, fontSize: 11, fontWeight: '800', textAlign: 'right' }}>{eyebrow}</Text> : null}
        <Text selectable style={{ color: colors.text, fontSize: 25, fontWeight: '900', textAlign: 'right' }}>{title}</Text>
        {subtitle ? <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
