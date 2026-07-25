import type { NextConfig } from "next";

const securityHeaders=[
 {key:'X-Content-Type-Options',value:'nosniff'},
 {key:'X-Frame-Options',value:'DENY'},
 {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: https:; media-src 'self' blob: https://*.supabase.co; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com; frame-src https:;"},
];
const noIndexRoutes=['/admin/:path*','/account/:path*','/workspace/:path*','/workspace-payment/:path*','/student/:path*','/dashboard','/onboarding','/auth/:path*','/api/:path*','/checkout','/cart','/order-confirmation','/payment/:path*','/forgot-password','/reset-password','/login','/register','/maintenance','/search','/blog/manage/:path*'];

const nextConfig:NextConfig={
 images:{remotePatterns:[{protocol:'https',hostname:'**.supabase.co',pathname:'/storage/v1/object/public/**'}]},
 experimental:{serverActions:{bodySizeLimit:'25mb'}},
 async redirects(){return[{source:'/apple-touch-icon.png',destination:'/brand/symbol-180x180.png',permanent:true}]},
 async headers(){return[{source:'/:path*',headers:securityHeaders},...noIndexRoutes.map(source=>({source,headers:[{key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'}]}))]},
};
export default nextConfig;
