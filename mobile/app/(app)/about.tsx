import Constants from 'expo-constants';
import { Text } from 'react-native';
import { PageHeader, Screen } from '@/components/screen';
import { Card } from '@/components/ui';
import { config } from '@/config';
import { useMadarTheme } from '@/providers/theme-provider';

export default function AboutScreen() {
  const { colors } = useMadarTheme();
  return <Screen><PageHeader eyebrow="مَدار | ORBIT" title="حول التطبيق" subtitle="تطبيق لوحة القيادة للأعمال" /><Card><Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'right' }}>الإصدار {Constants.expoConfig?.version || '2.0.0'}</Text><Text selectable style={{ color: colors.muted, lineHeight: 23, textAlign: 'right' }}>يعرض التطبيق المؤشرات والتنبيهات والتقارير وأوربي بحسب نشاط مساحة العمل وطريقة تشغيلها، مع تنفيذ مقيد للأوامر الآمنة فقط.</Text><Text selectable style={{ color: colors.faint, textAlign: 'right' }}>القناة: {config.releaseChannel}</Text></Card><Card><Text selectable style={{ color: colors.text, fontWeight: '900', textAlign: 'right' }}>تطوير وإدارة</Text><Text selectable style={{ color: colors.muted, lineHeight: 22, textAlign: 'right' }}>طُوّر أوربي وتطبيق مَدار بواسطة مؤسس مَدار ومدير فريقها.</Text></Card></Screen>;
}
