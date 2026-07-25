import type {Metadata,Viewport} from 'next';
import Script from 'next/script';
import {siteConfig} from '@/src/config/site';
import {absoluteUrl,safeJsonLd} from '@/src/lib/seo';
import './globals.css';
import {CartProvider} from '@/components/cart/CartProvider';
import PlatformStatusBar from '@/components/platform/PlatformStatusBar';
import ThemeProvider from '@/components/theme/ThemeProvider';
import NavigationExperience from '@/components/navigation/NavigationExperience';

const metadataBase=new URL(siteConfig.baseUrl);
const googleAnalyticsId='G-PT7RKF7295';
const themeBootstrap=`(()=>{try{const saved=localStorage.getItem('madar-theme');const theme=saved==='light'||saved==='dark'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');const root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme}catch{document.documentElement.dataset.theme='dark'}})();`;
const organizationJsonLd={
 '@context':'https://schema.org','@type':'Organization','@id':`${siteConfig.baseUrl}/#organization`,name:siteConfig.name,url:siteConfig.baseUrl,logo:absoluteUrl('/brand/symbol-512x512.png'),image:absoluteUrl(siteConfig.assets.ogImage),email:siteConfig.email,telephone:siteConfig.phone,sameAs:[siteConfig.social.x,siteConfig.social.instagram],contactPoint:{'@type':'ContactPoint',contactType:'customer support',email:siteConfig.email,telephone:siteConfig.phone,availableLanguage:['ar']},
};
const websiteJsonLd={
 '@context':'https://schema.org','@type':'WebSite','@id':`${siteConfig.baseUrl}/#website`,name:siteConfig.name,url:siteConfig.baseUrl,description:siteConfig.description,inLanguage:'ar',publisher:{'@id':`${siteConfig.baseUrl}/#organization`},potentialAction:{'@type':'SearchAction',target:{'@type':'EntryPoint',urlTemplate:`${siteConfig.baseUrl}/search?q={search_term_string}`},'query-input':'required name=search_term_string'},
};

export const metadata:Metadata={metadataBase,title:{default:siteConfig.seo.title,template:siteConfig.seo.titleTemplate},description:siteConfig.description,applicationName:siteConfig.shortName,keywords:[...siteConfig.seo.keywords],authors:[{name:siteConfig.companyName,url:siteConfig.baseUrl}],creator:siteConfig.companyName,publisher:siteConfig.companyName,robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},icons:{icon:siteConfig.assets.favicon,shortcut:siteConfig.assets.favicon,apple:siteConfig.assets.appleTouchIcon},formatDetection:{email:false,address:false,telephone:false}};
export const viewport:Viewport={themeColor:[{media:'(prefers-color-scheme: light)',color:'#f7f8fc'},{media:'(prefers-color-scheme: dark)',color:'#070a12'}]};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ar" dir="rtl" className="h-full scroll-smooth antialiased" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd([organizationJsonLd,websiteJsonLd])}}/></head><body className="flex min-h-full flex-col"><ThemeProvider><NavigationExperience/><PlatformStatusBar/><CartProvider>{children}</CartProvider></ThemeProvider><Script src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`} strategy="afterInteractive"/><Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${googleAnalyticsId}');`}</Script></body></html>}
