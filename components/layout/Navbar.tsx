'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { siteConfig } from '@/src/config/site';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === siteConfig.links.home ? pathname === href : pathname?.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 border-b border-[#E2E8F0]/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85" aria-label="التنقل الرئيسي">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href={siteConfig.links.home} className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2" aria-label={`${siteConfig.name} - الرئيسية`}>
            <Image src={siteConfig.assets.logo} alt="" width={120} height={40} priority className="h-10 w-auto" />
            <span className="truncate text-base font-bold text-[#0F172A] sm:text-lg">{siteConfig.name}</span>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {siteConfig.nav.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#6C3BFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2 aria-[current=page]:text-[#6C3BFF]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:block">
            <Link href={siteConfig.links.checkout} className="inline-flex rounded-xl bg-gradient-to-r from-[#6C3BFF] to-[#00C2A8] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2">
              شراء الآن
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            className="rounded-xl p-2 text-[#0F172A] transition-colors hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2 md:hidden"
            aria-label={isOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={isOpen}
            aria-controls="mobile-navigation"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {isOpen && (
          <div id="mobile-navigation" className="border-t border-[#E2E8F0] py-4 md:hidden">
            <div className="flex flex-col gap-2">
              {siteConfig.nav.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-lg px-3 py-3 font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#6C3BFF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF]" onClick={() => setIsOpen(false)}>
                  {link.label}
                </Link>
              ))}
              <Link href={siteConfig.links.checkout} className="mt-2 rounded-xl bg-gradient-to-r from-[#6C3BFF] to-[#00C2A8] px-6 py-3 text-center font-semibold text-white shadow-sm transition-all hover:shadow-lg active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF]" onClick={() => setIsOpen(false)}>
                شراء الآن
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
