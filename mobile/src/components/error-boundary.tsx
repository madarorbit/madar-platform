import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

type State = { error: Error | null };
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MADAR mobile boundary', error.name, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#070A12' }}>
        <View style={{ gap: 14, padding: 20, borderRadius: 20, backgroundColor: '#111827' }}>
          <Text selectable style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '800', textAlign: 'right' }}>تعذر فتح هذه الشاشة</Text>
          <Text selectable style={{ color: '#9AA8BD', fontSize: 15, lineHeight: 24, textAlign: 'right' }}>أوقف التطبيق الخطأ بأمان. أعد تحميل الواجهة، وإذا تكرر العطل أرسل تفاصيل الإصدار إلى فريق مَدار.</Text>
          <Pressable accessibilityRole="button" onPress={() => this.setState({ error: null })} style={{ padding: 14, borderRadius: 14, backgroundColor: '#70E4D4' }}>
            <Text style={{ color: '#07120F', fontWeight: '800', textAlign: 'center' }}>إعادة تحميل الواجهة</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }
}
