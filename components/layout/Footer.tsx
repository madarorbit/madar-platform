import Image from 'next/image';
import Link from 'next/link';
import { siteConfig } from '@/src/config/site';

const footerGroups = [
  { title: 'المنتجات', links: [
    { label: 'أنظمة الذكاء الاصطناعي', href: siteConfig.links.products },
    { label: 'قوالب Notion', href: siteConfig.links.products },
    { label: 'أتمتة الأعمال', href: siteConfig.links.products },
    { label: 'أنظمة Google Sheets', href: siteConfig.links.products },
  ] },
  { title: 'الشركة', links: [
    { label: 'عن مَدار', href: siteConfig.links.about },
    { label: 'المدونة', href: siteConfig.links.about },
    { label: 'الوظائف', href: siteConfig.links.contact },
    { label: 'اتصل بنا', href: siteConfig.links.contact },
  ] },
  { title: 'القانوني', links: [
    { label: 'سياسة الخصوصية', href: siteConfig.links.privacy },
    { label: 'شروط الاستخدام', href: siteConfig.links.terms },
    { label: 'سياسة الاسترجاع', href: siteConfig.links.terms },
    { label: 'اتفاقية الخدمة', href: siteConfig.links.terms },
  ] },
  { title: 'الموارد', links: [
    { label: 'مركز المساعدة', href: siteConfig.links.faq },
    { label: 'الوثائق', href: siteConfig.links.faq },
    { label: 'البرامج التعليمية', href: siteConfig.links.services },
    { label: 'المجتمع', href: siteConfig.links.contact },
  ] },
];

const socialLinks = [
  { name: 'X', icon: '𝕏', href: siteConfig.social.x },
  { name: 'Instagram', icon: '◎', href: siteConfig.social.instagram },
  { name: 'واتساب', icon: '◌', href: siteConfig.social.whatsapp },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contact" className="bg-[#0F172A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          <div className="lg:col-span-1">
            <Link href={siteConfig.links.home} className="mb-6 flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]" aria-label={`${siteConfig.name} - الرئيسية`}>
              <Image src={siteConfig.assets.logoWhite} alt="" width={120} height={40} className="h-10 w-auto" />
              <span className="font-bold">{siteConfig.name}</span>
            </Link>
            <p className="mb-6 text-sm leading-7 text-white/70">{siteConfig.description}</p>
            <address className="mb-6 space-y-2 not-italic text-sm text-white/70">
              <p><a className="transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></p>
              <p><a className="transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white" href={`tel:${siteConfig.phone}`}>{siteConfig.phone}</a></p>
            </address>
            <div className="flex gap-3" aria-label="روابط التواصل الاجتماعي">
              {socialLinks.map((social) => (
                <a key={social.name} href={social.href} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:bg-white/20 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={social.name}>
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-5 font-semibold text-white">{group.title}</h2>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    <Link href={link.href} className="text-sm text-white/65 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="my-10 border-t border-white/10" />

        <div className="flex flex-col items-center justify-between gap-5 text-sm text-white/65 md:flex-row">
          <p>© {currentYear} {siteConfig.name}. {siteConfig.copyright}</p>
          <div className="flex flex-wrap justify-center gap-5">
            <Link href={siteConfig.links.privacy} className="transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white">سياسة الخصوصية</Link>
            <Link href={siteConfig.links.terms} className="transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white">شروط الاستخدام</Link>
            <Link href={siteConfig.links.contact} className="transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white">اتصل بنا</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
