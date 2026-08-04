import { Text } from 'react-native';
import { PageHeader, Screen } from '@/components/screen';
import { Card, SectionTitle } from '@/components/ui';
import { useMadarTheme } from '@/providers/theme-provider';

export default function PrivacyScreen() {
  const { colors } = useMadarTheme();
  const paragraph = { color: colors.muted, lineHeight: 23, textAlign: 'right' as const };
  return <Screen><PageHeader eyebrow="الخصوصية" title="سياسة التطبيق" subtitle="ملخص خاص بتطبيق لوحة القيادة V2.0" /><Card><SectionTitle title="الجلسة والبيانات" /><Text selectable style={paragraph}>تُحفظ رموز الجلسة والنسخة المحلية الحساسة داخل Secure Storage المشفر في الجهاز. لا يضم التطبيق مفاتيح Connector أو مفاتيح نماذج أوربي.</Text></Card><Card><SectionTitle title="المزامنة" /><Text selectable style={paragraph}>يعرض التطبيق وقت آخر مزامنة بوضوح، ولا يصف النسخة القديمة بأنها لحظية. لا تُنفذ كتابة خارجية أثناء انقطاع الشبكة.</Text></Card><Card><SectionTitle title="الأوامر" /><Text selectable style={paragraph}>كل أمر يحتاج صلاحية ومعاينة وتأكيدًا. لا يظهر نجاح التنفيذ قبل تأكيد النظام ومسار المزامنة. الأسعار والمدفوعات والحذف الحساس وإدارة الصلاحيات محظورة داخل هذا الإصدار.</Text></Card><Card><SectionTitle title="الإشعارات والمرفقات" /><Text selectable style={paragraph}>لا تُفعّل الإشعارات أو المرفقات إلا بإذن المستخدم وضمن الأنواع والأحجام والسياسات المحددة من مَدار.</Text></Card></Screen>;
}
