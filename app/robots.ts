import type {MetadataRoute} from 'next';
import {siteConfig} from '@/src/config/site';

export default function robots():MetadataRoute.Robots{
 return{
  rules:{
   userAgent:'*',
   allow:'/',
   disallow:['/admin/','/account/','/workspace/','/student/','/api/','/auth/','/checkout','/cart','/onboarding','/order-confirmation','/payment/','/forgot-password','/reset-password'],
  },
  sitemap:`${siteConfig.baseUrl}/sitemap.xml`,
  host:siteConfig.baseUrl,
 };
}