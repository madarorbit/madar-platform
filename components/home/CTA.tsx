import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
export default function CTA({
  authenticated = false,
}: {
  authenticated?: boolean;
}) {
  return (
    <section className="md-section px-4 sm:px-6">
      <div className="md-home-cta">
        <div>
          <span className="md-feature-icon is-mixed mx-auto">
            <Icon name="sparkles" className="h-8 w-8" />
          </span>
          <h2 className="md-type-h1 mx-auto mt-5 max-w-3xl">
            ابنِ منظومة أوضح لأعمالك مع مَدار | ORBIT
          </h2>
          <p className="md-type-body-lg md-secondary mx-auto mt-5 max-w-2xl">
            {authenticated
              ? "تابع حسابك وخدماتك المستقلة من مركز واحد متناسق."
              : "أنشئ حساب مَدار، ثم اختر الخدمة التي تحتاجها وفعّلها بخطوات واضحة."}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={authenticated ? "/account" : "/register"}
              className="md-button md-button-primary md-button-lg"
            >
              {authenticated ? "الانتقال إلى لوحة التحكم" : "إنشاء حساب"}
            </Link>
            <Link
              href="/contact"
              className="md-button md-button-secondary md-button-lg"
            >
              تحدث معنا
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
