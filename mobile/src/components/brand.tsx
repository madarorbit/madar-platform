import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import brandSymbol from '../../../public/brand/symbol-512x512.png';
import { useMadarTheme } from '@/providers/theme-provider';

export function Brand({ compact = false }: { compact?: boolean }) {
  const { colors } = useMadarTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
      <Image accessibilityLabel="شعار مَدار" source={brandSymbol} contentFit="contain" style={{ width: compact ? 34 : 56, height: compact ? 34 : 56 }} />
      {!compact && (
        <View>
          <Text selectable style={{ color: colors.text, fontSize: 21, fontWeight: '900', textAlign: 'right' }}>مَدار</Text>
          <Text selectable style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textAlign: 'right' }}>ORBIT</Text>
        </View>
      )}
    </View>
  );
}
