import type { Metadata, Viewport } from 'next';
import { siteConfig } from '@/src/config/site';
import './globals.css';


const metadataBase = new URL(siteConfig.baseUrl);

export const metadata: Metadata = {
  metadataBase,
  title: { default: siteConfig.seo.title, template: siteConfig.seo.titleTemplate },
  description: siteConfig.description,
  applicationName: siteConfig.shortName,
  keywords: [...siteConfig.seo.keywords],
  authors: [{ name: siteConfig.companyName, url: siteConfig.baseUrl }],
  creator: siteConfig.companyName,
  publisher: siteConfig.companyName,
  alternates: { canonical: siteConfig.links.home },
  icons: {
    icon: siteConfig.assets.favicon,
    shortcut: siteConfig.assets.favicon,
    apple: siteConfig.assets.appleTouchIcon,
  },
  openGraph: {
    title: siteConfig.seo.title,
    description: siteConfig.description,
    url: siteConfig.baseUrl,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: siteConfig.openGraph.type,
    images: [{ url: siteConfig.assets.ogImage, width: siteConfig.openGraph.imageWidth, height: siteConfig.openGraph.imageHeight, alt: siteConfig.openGraph.imageAlt }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.seo.title,
    description: siteConfig.description,
    creator: siteConfig.seo.twitterHandle,
    images: [siteConfig.assets.ogImage],
  },
};

export const viewport: Viewport = { themeColor: siteConfig.themeColor };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className="h-full scroll-smooth antialiased">
      <body className="flex min-h-full flex-col bg-white text-[#0F172A]">{children}</body>
    </html>
  );
}
