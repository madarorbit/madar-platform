import Image from "next/image";
import Link from "next/link";
import PageShell from "@/components/ui/PageShell";
import { PageHero, Section } from "@/components/ui/Section";
import { Badge, Card, Grid } from "@/components/ui/Enterprise";
import { ContentSections } from "@/components/ui/ContentPage";
import { MadarIllustration } from "@/components/ui/MadarIllustration";
import { siteConfig } from "@/src/config/site";

export const metadata = {
  title: "عن مَدار",
  description: "رؤية مَدار ورسالتها ومنهجها في إدارة التجارة ورقمنة الأعمال العربية.",
};

export default function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="عن مَدار"
        title="نبني البنية التي تساعد الأعمال العربية على الحركة بذكاء"
        description="مَدار منصة تتوسع حول احتياجات التجارة والأعمال: إدارة ورقمنة ومنتجات وخدمات وقدرات ذكية مبنية على أساس منظم."
      />
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <Badge variant="brand">رؤية مؤسسية عربية</Badge>
            <h2 className="mt-5 text-3xl font-black">الرؤية</h2>
            <p className="md-about-copy mt-5 text-lg leading-9">
              أن تصبح مَدار منصة عربية موثوقة تمكّن التجارة والأعمال من تحويل
              عملياتها اليومية إلى منظومة رقمية واضحة، قابلة للقياس والتوسع
              والاستفادة من الذكاء الاصطناعي.
            </p>
            <h2 className="mt-9 text-3xl font-black">الرسالة</h2>
            <p className="md-about-copy mt-5 text-lg leading-9">
              نبسّط التعقيد التشغيلي، ونبني حلولًا عربية عملية تربط البيانات
              بالأدوات والقرارات، مع الحفاظ على أمن المعلومات ووضوح تجربة
              المستخدم.
            </p>
          </div>
          <Image
            src={siteConfig.assets.identityImage}
            alt="الهوية الرسمية لمنصة مَدار"
            width={1536}
            height={1536}
            sizes="(max-width: 1023px) calc(100vw - 2rem), 48vw"
            className="md-about-identity-image w-full"
          />
        </div>
        <div className="mt-14">
          <ContentSections
            sections={[
              { title: "العربية أولًا", body: "نبني المصطلحات والتدفقات والواجهات انطلاقًا من احتياجات المستخدم العربي، لا كترجمة لاحقة لمنتج أجنبي.", icon: "community" },
              { title: "العملية قبل الاستعراض", body: "قيمة الحل تقاس بقدرته على تقليل التشتت وتحسين القرار وتوفير الوقت، لذلك نبدأ من المشكلة التشغيلية.", icon: "automation" },
              { title: "الأمان والملكية", body: "نعزل بيانات العملاء، ونطبّق الصلاحيات بأقل امتياز لازم، ونوضح حدود كل خدمة ومنتج.", icon: "shield" },
              { title: "بنية قابلة للتوسع", body: "نبني مكونات مستقلة ومترابطة حتى تنمو المنصة من دون هدم ما سبق أو ربط العميل بأداة واحدة.", icon: "layers" },
            ]}
          />
        </div>
        <section id="orby" className="scroll-mt-28 pt-16">
          <Card className="md-orby-intro-card p-0">
            <div className="md-orby-intro-grid">
              <div className="md-orby-master-frame mx-auto w-full max-w-md">
                <Image
                  src={siteConfig.assets.orbyMaster}
                  alt="ORBY — مساعد مَدار الذكي"
                  width={1536}
                  height={1536}
                  sizes="(max-width: 1023px) calc(100vw - 3rem), 34vw"
                  className="md-orby-master-image"
                />
              </div>
              <div className="min-w-0">
                <Badge variant="success">مساعد مَدار الذكي</Badge>
                <h2 className="md-orby-intro-title mt-5 font-black">أوربي يفهم سياق عملك، لا سؤالك فقط</h2>
                <p className="md-about-copy mt-5 text-lg leading-9">
                  يعمل أوربي داخل مساحات مَدار المعزولة، ويستند إلى بيانات
                  المساحة وصلاحيات المستخدم ليقدّم تحليلات واقتراحات عملية دون
                  فتح وصول عشوائي إلى قاعدة البيانات.
                </p>
                <Grid className="md-orby-feature-grid mt-7 sm:grid-cols-2" auto={false}>
                  <div className="md-orby-feature"><MadarIllustration kind="analysis"/><strong>تحليل وتشخيص</strong><p>يلخص المؤشرات ويكشف التغيرات والمخاطر التشغيلية.</p></div>
                  <div className="md-orby-feature"><MadarIllustration kind="intelligence"/><strong>اقتراح الخطوة التالية</strong><p>يربط البيانات بالسياق ليقترح إجراءً مفهومًا وقابلًا للمراجعة.</p></div>
                  <div className="md-orby-feature"><MadarIllustration kind="security"/><strong>ضوابط وصلاحيات</strong><p>لا ينفذ إجراءً حساسًا دون تأكيد، ولا يتجاوز صلاحية المستخدم.</p></div>
                  <div className="md-orby-feature"><MadarIllustration kind="context"/><strong>فهم سياق العمل</strong><p>يدعم التحليل التجاري والتلخيص والشرح ضمن بيانات الخدمة المصرح بها.</p></div>
                </Grid>
                <div className="md-orby-intro-actions mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/orby" className="md-button md-button-primary">ابدأ محادثة مع ORBY</Link>
                  <Link href="/help" className="md-button md-button-secondary">تعرّف على طريقة الاستخدام</Link>
                </div>
              </div>
            </div>
          </Card>
        </section>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/register" className="md-button md-button-primary md-button-lg">ابدأ مع مَدار</Link>
          <Link href="/contact" className="md-button md-button-secondary md-button-lg">تواصل معنا</Link>
        </div>
      </Section>
    </PageShell>
  );
}
