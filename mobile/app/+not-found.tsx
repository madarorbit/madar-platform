import { router } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/screen';
import { AppButton, Card } from '@/components/ui';
import { useMadarTheme } from '@/providers/theme-provider';

export default function NotFound() {
  const { colors } = useMadarTheme();
  return <Screen contentContainerStyle={{ justifyContent: 'center' }}><Card><Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'right' }}>هذه الشاشة غير موجودة</Text><Text selectable style={{ color: colors.muted, textAlign: 'right', lineHeight: 22 }}>ارجع إلى لوحة القيادة بدل متابعة رابط غير صالح.</Text><AppButton label="العودة إلى مَدار" onPress={() => router.replace('/')} /></Card></Screen>;
}
