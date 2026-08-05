import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/src/config/site";
import { Icon, type IconName } from "@/components/ui/Icons";

const groups = [
  { title: "المنتج", links: [["منصة مَدار", "/about"], ["أوربي", "/about#orby"], ["المتجر", "/store"], ["المدونة", "/blog"]] },
  { title: "الاستخدام", links: [["ابدأ الآن", "/register"], ["تسجيل الدخول", "/login"], ["الوثائق", "/docs"], ["مركز المساعدة", "/help"]] },
  { title: "الشركة", links: [["عن مَدار", "/about"], ["الوظائف", "/careers"], ["المجتمع", "/community"], ["تواصل معنا", "/contact"]] },
  { title: "القانوني", links: [["سياسة الخصوصية", "/privacy"], ["شروط الاستخدام", "/terms"], ["سياسة الاسترجاع", "/refund-policy"], ["اتفاقية الخدمة", "/service-agreement"]] },
];
const socials: { name: string; href: string; icon: IconName }[] = [
  { name: "حساب مَدار على منصة إكس", href: siteConfig.social.x, icon: "x" },
  { name: "حساب مَدار على إنستجرام", href: siteConfig.social.instagram, icon: "instagram" },
  { name: "التواصل المباشر مع مَدار", href: siteConfig.social.whatsapp, icon: "whatsapp" },
];

export default function Footer() {
  return <footer className="md-public-footer md-no-print">
    <div className="md-container">
      <div className="md-public-footer-main">
        <section className="md-public-footer-brand">
          <Link href="/"><Image src={siteConfig.assets.logoWhite} alt="مَدار | ORBIT" width={190} height={44} /></Link>
          <p>{siteConfig.description}</p>
          <Link href={siteConfig.links.orby} className="md-public-footer-orby"><Image src={siteConfig.assets.orby} alt="أوربي" width={34} height={34} unoptimized /><span><strong>أوربي</strong><small>ذكاء الأعمال داخل مَدار</small></span></Link>
          <div className="md-public-socials" aria-label="حسابات مَدار الاجتماعية">{socials.map((social) => <a key={social.name} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.name}><Icon name={social.icon} /></a>)}</div>
        </section>
        <div className="md-public-footer-links">{groups.map((group) => <section key={group.title}><h2>{group.title}</h2>{group.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</section>)}</div>
      </div>
      <div className="md-public-footer-bottom"><p>© {new Date().getFullYear()} مَدار | ORBIT. {siteConfig.copyright}</p><div><span className="md-public-status-dot" />الخدمات تعمل بصورة طبيعية</div><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></div>
    </div>
  </footer>;
}
