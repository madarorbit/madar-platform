import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import { Card, Grid } from '@/components/ui/Enterprise';
import { PageHero, Section } from '@/components/ui/Section';
import { requireUser } from '@/src/lib/auth';
import { currentProfile } from '@/src/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PUBLIC_ANDROID_APK_URL =
  'https://github.com/madarorbit/madar-platform/releases/download/mobile-v2-stable/MADAR-Mobile.apk';
const PUBLIC_ANDROID_CHECKSUM_URL =
  'https://github.com/madarorbit/madar-platform/releases/download/mobile-v2-stable/MADAR-Mobile.apk.sha256';

export default async function MobileReleasePage() {
  await requireUser();
  const profile = await currentProfile();
  const apkUrl = process.env.NEXT_PUBLIC_MADAR_ANDROID_APK_URL?.trim() || PUBLIC_ANDROID_APK_URL;
  const storeUrl = process.env.NEXT_PUBLIC_MADAR_ANDROID_STORE_URL?.trim();
  const isBusiness = profile?.account_type === 'BUSINESS';
  return (
    <PageShell>
      <PageHero
        eyebrow="تطبيق مَدار V2.1"
        title="لوحة عملك في الهاتف"
        description="تطبيق Android مخصص لحسابات الأعمال، يعرض المؤشرات والتنبيهات والتقارير وأوربي بحسب نشاط مساحة العمل ومصدر بياناتها."
      />
      <Section>
        <Grid className="lg:grid-cols-3" auto={false}>
          <Card className="lg:col-span-2">
            <h2 className="text-2xl font-black">الإصدار الحالي: 2.1.0</h2>
            <p className="mt-3 leading-8 text-slate-400">
              إصدار Release مستقل وموقّع من مشروع مَدار موبايل على Expo/EAS. يحفظ الجلسة داخل التخزين الآمن، ويعرض آخر مزامنة، ولا يحتاج Metro أو بيئة تطوير كي يعمل.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {storeUrl ? <a className="md-button md-button-primary" href={storeUrl} rel="noreferrer">فتح صفحة Google Play</a> : null}
              <a className="md-button md-button-primary" href={apkUrl} rel="noreferrer">تحميل تطبيق مَدار Android</a>
              <a className="md-button md-button-secondary" href={PUBLIC_ANDROID_CHECKSUM_URL} rel="noreferrer">بصمة التحقق SHA-256</a>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              هذه حزمة Android رسمية مباشرة. قد يطلب النظام السماح بالتثبيت من المتصفح المستخدم عند التثبيت لأول مرة.
            </p>
          </Card>
          <Card>
            <h2 className="text-lg font-black">شروط الدخول</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
              <li>حساب BUSINESS نشط.</li>
              <li>مساحة عمل تجارية مرتبطة.</li>
              <li>اشتراك صالح أو تجربة نشطة.</li>
              <li>لا تُنفذ كتابة خارجية دون صلاحية ومعاينة وتأكيد.</li>
            </ul>
          </Card>
        </Grid>
        {!isBusiness ? <Card className="mt-6 border-amber-300/20"><strong>هذا الحساب شخصي.</strong><p className="mt-2 text-slate-400">التطبيق لن يسمح بالدخول حتى يتحول الحساب إلى حساب أعمال ويرتبط بمساحة تجارية.</p></Card> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="md-button md-button-secondary" href="/privacy">سياسة الخصوصية</Link>
          <Link className="md-button md-button-secondary" href="/account/support">الدعم</Link>
        </div>
      </Section>
    </PageShell>
  );
}
