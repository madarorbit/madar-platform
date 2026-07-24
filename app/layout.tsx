import type {Metadata,Viewport} from 'next';
import {siteConfig} from '@/src/config/site';
import './globals.css';
import {CartProvider} from '@/components/cart/CartProvider';
import PlatformStatusBar from '@/components/platform/PlatformStatusBar';

const metadataBase=new URL(siteConfig.baseUrl);
export const metadata:Metadata={metadataBase,title:{default:siteConfig.seo.title,template:siteConfig.seo.titleTemplate},description:siteConfig.description,applicationName:siteConfig.shortName,keywords:[...siteConfig.seo.keywords],authors:[{name:siteConfig.companyName,url:siteConfig.baseUrl}],creator:siteConfig.companyName,publisher:siteConfig.companyName,alternates:{canonical:siteConfig.links.home},icons:{icon:siteConfig.assets.favicon,shortcut:siteConfig.assets.favicon,apple:siteConfig.assets.appleTouchIcon},openGraph:{title:siteConfig.seo.title,description:siteConfig.description,url:siteConfig.baseUrl,siteName:siteConfig.name,locale:siteConfig.locale,type:siteConfig.openGraph.type,images:[{url:siteConfig.assets.ogImage,width:siteConfig.openGraph.imageWidth,height:siteConfig.openGraph.imageHeight,alt:siteConfig.openGraph.imageAlt}]},twitter:{card:'summary_large_image',title:siteConfig.seo.title,description:siteConfig.description,creator:siteConfig.seo.twitterHandle,images:[siteConfig.assets.ogImage]}};
export const viewport:Viewport={themeColor:[{media:'(prefers-color-scheme: light)',color:'#f5f7fb'},{media:'(prefers-color-scheme: dark)',color:'#070a12'}]};

const themeInitializer=`(()=>{try{const key='madar-theme';const saved=localStorage.getItem(key);const theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');const root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='light'?'#f5f7fb':'#070a12')}catch(_){document.documentElement.dataset.theme='dark'}})();`;

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl" className="h-full scroll-smooth antialiased" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeInitializer}}/></head><body className="flex min-h-full flex-col"><PlatformStatusBar/><CartProvider>{children}</CartProvider></body></html>}
