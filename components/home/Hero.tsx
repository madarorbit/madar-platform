import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/src/config/site";
import { Icon } from "@/components/ui/Icons";

export default function Hero({
  authenticated = false,
}: {
  authenticated?: boolean;
}) {
  return (
    <section className="md-home-hero">
      <div className="md-home-hero-ambient" aria-hidden="true" />
      <div className="md-container md-home-hero-grid">
        <div>
          <div className="md-eyebrow">
            <Icon name="sparkles" className="h-4 w-4" />
            منصة عربية مؤسسية للأعمال الذكية
          </div>
          <h1 className="md-home-hero-title">
            أدر أعمالك من منظومة واحدة، واتخذ قراراتك على أساس{" "}
            <span className="md-brand-text">
              بيانات واضحة وذكاء عملي
            </span>
          </h1>
          <p className="md-home-hero-description">
            تجمع مَدار | ORBIT المبيعات والمخزون والعملاء والمصروفات والمهام
            والتقارير في تجربة عربية متماسكة، لتمنح تجارتك وضوحًا تشغيليًا وقدرة
            حقيقية على النمو.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={authenticated ? "/account" : siteConfig.links.start}
              className="md-button md-button-primary md-button-lg"
            >
              <Icon name="user" />
              {authenticated ? "الانتقال إلى حسابي" : "ابدأ مع مَدار | ORBIT"}
            </Link>
            <Link
              href={siteConfig.links.store}
              className="md-button md-button-secondary md-button-lg"
            >
              <Icon name="store" />
              استكشف المتجر
            </Link>
          </div>
          <form
            action="/search"
            className="md-home-search"
            role="search"
          >
            <label className="sr-only" htmlFor="home-search">
              ابحث في مَدار | ORBIT
            </label>
            <Icon name="search" className="h-5 w-5 md-muted" />
            <input
              id="home-search"
              name="q"
              className="md-input min-w-0 flex-1 border-0 bg-transparent shadow-none"
              placeholder="ابحث عن منتج أو خدمة أو وثيقة"
            />
            <button className="md-button md-button-primary md-button-sm">
              بحث
            </button>
          </form>
          <div className="md-home-value-grid">
            <div className="md-stat">
              <strong className="md-stat-value">
                منظومة واحدة
              </strong>
              <span className="md-stat-label">للعمليات والبيانات</span>
            </div>
            <div className="md-stat">
              <strong className="md-stat-value">
                عربية بالكامل
              </strong>
              <span className="md-stat-label">في التجربة والمحتوى</span>
            </div>
            <div className="md-stat">
              <strong className="md-stat-value">
                معزولة وآمنة
              </strong>
              <span className="md-stat-label">لكل مساحة عمل</span>
            </div>
          </div>
        </div>
        <div className="md-home-visual-wrap">
          <div className="md-home-visual-glow" aria-hidden="true" />
          <div className="md-home-visual">
            <video
              className="md-home-visual-video"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={siteConfig.assets.identityImage}
              aria-label="الهوية الحركية لشعار مَدار | ORBIT"
            >
              <source src={siteConfig.assets.identityVideo} type="video/mp4" />
            </video>
            <Link
              href={siteConfig.links.orby}
              className="md-home-orby-card"
            >
              <Image
                src={siteConfig.assets.orby}
                alt="صورة أوربي"
                width={58}
                height={58}
                unoptimized
                className="md-orby-alive h-14 w-14 rounded-[var(--md-radius-lg)] object-cover"
              />
              <span>
                <strong className="block text-base">
                  أوربي، مساعد مَدار | ORBIT الذكي
                </strong>
                <span className="md-type-body-sm md-muted mt-1 block">
                  يحلل بياناتك ويقترح الخطوة التالية بوضوح.
                </span>
              </span>
              <Icon name="arrow" className="md-icon-directional mr-auto h-5 w-5 text-[var(--md-mint)]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
