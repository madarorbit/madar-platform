import {NextRequest,NextResponse} from 'next/server';
import {refreshSession} from './src/lib/auth/session-refresh';

const SESSION_MAX_AGE=60*60*24*365;
const cookieOptions=(maxAge:number,httpOnly=true)=>({httpOnly,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge});
const maintenanceAllowed=['/maintenance','/login','/auth','/admin','/api/health','/_next','/favicon','/robots.txt','/sitemap.xml'];
const sessionProtected=['/admin','/account','/dashboard','/onboarding','/workspace','/workspace-payment','/retail/onboarding','/retail/workspace'];
const authOnly=['/login','/register','/forgot-password'];
const authRefreshBypass=['/auth/recover','/auth/refresh'];

type JwtPayload={exp?:number;sub?:string};
type Session={access_token:string;refresh_token:string;expires_in:number};

function jwtPayload(token:string):JwtPayload{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()) as JwtPayload}catch{return{}}}
function expiresSoon(token:string){const payload=jwtPayload(token);return !payload.exp||payload.exp<=Math.floor(Date.now()/1000)+300}
function tokenExpired(token:string){const payload=jwtPayload(token);return !payload.exp||payload.exp<=Math.floor(Date.now()/1000)}
function isProtected(path:string){return sessionProtected.some(prefix=>path===prefix||path.startsWith(`${prefix}/`))}
function isAuthOnly(path:string){return authOnly.some(prefix=>path===prefix||path.startsWith(`${prefix}/`))}
function isStaticAsset(path:string){return path.startsWith('/_next/')||path.startsWith('/brand/')||path.startsWith('/assets/')||path==='/manifest.webmanifest'||path==='/robots.txt'||path==='/sitemap.xml'||path==='/favicon.ico'||/\.(?:png|jpe?g|webp|gif|svg|ico|css|js|map|woff2?|ttf|otf|mp4|webm|mp3|wav|pdf|zip)$/i.test(path)}
function isDocumentNavigation(request:NextRequest){const dest=request.headers.get('sec-fetch-dest');if(dest==='document')return true;const accept=request.headers.get('accept')||'';return !request.headers.has('rsc')&&accept.includes('text/html')}
function safeReturnTo(value:string|null|undefined,fallback='/account'){return value?.startsWith('/')&&!value.startsWith('//')&&!value.startsWith('/login')?value:fallback}
function loginRedirect(request:NextRequest){const target=request.nextUrl.clone(),next=`${request.nextUrl.pathname}${request.nextUrl.search}`;target.pathname='/login';target.search='';target.searchParams.set('next',next);return NextResponse.redirect(target)}
function authenticatedRedirect(request:NextRequest){return NextResponse.redirect(new URL(safeReturnTo(request.nextUrl.searchParams.get('next')),request.url))}
function clearSession(response:NextResponse){response.cookies.set('madar-access-token','',cookieOptions(0));response.cookies.set('madar-refresh-token','',cookieOptions(0));}
function rememberPath(response:NextResponse,request:NextRequest){if(isProtected(request.nextUrl.pathname)){const value=`${request.nextUrl.pathname}${request.nextUrl.search}`;response.cookies.set('madar-last-path',encodeURIComponent(value),cookieOptions(SESSION_MAX_AGE,false));}}
function forwardedResponse(request:NextRequest,authRecoveryPending=false){const requestHeaders=new Headers(request.headers);if(authRecoveryPending)requestHeaders.set('x-madar-auth-recovery-pending','1');return NextResponse.next({request:{headers:requestHeaders}})}
function setSessionCookies(response:NextResponse,session:Session){response.cookies.set('madar-access-token',session.access_token,cookieOptions(session.expires_in||3600));response.cookies.set('madar-refresh-token',session.refresh_token,cookieOptions(SESSION_MAX_AGE));response.headers.set('Cache-Control','private, no-store');}
function refreshedResponse(request:NextRequest,session:Session){request.cookies.set('madar-access-token',session.access_token);request.cookies.set('madar-refresh-token',session.refresh_token);const result=isAuthOnly(request.nextUrl.pathname)?authenticatedRedirect(request):forwardedResponse(request);setSessionCookies(result,session);rememberPath(result,request);return result;}
function recoveryPendingResponse(request:NextRequest){const result=forwardedResponse(request,true);rememberPath(result,request);result.headers.set('Cache-Control','private, no-store');result.headers.set('X-MADAR-Auth-Recovery','pending');return result;}

async function maintenanceRedirect(request:NextRequest){
 const path=request.nextUrl.pathname;if(maintenanceAllowed.some(prefix=>path.startsWith(prefix))||/\.[a-z0-9]+$/i.test(path))return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!base||!key)return null;
 try{const response=await fetch(`${base.replace(/\/$/,'')}/rest/v1/platform_settings?id=eq.1&select=maintenance_mode`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:30}}),settings=await response.json();if(response.ok&&settings?.[0]?.maintenance_mode){const target=request.nextUrl.clone();target.pathname='/maintenance';target.search='';return NextResponse.redirect(target)}}catch{}
 return null;
}

export async function proxy(request:NextRequest){
 const maintenance=await maintenanceRedirect(request);if(maintenance)return maintenance;
 const path=request.nextUrl.pathname;
 if(isStaticAsset(path)||authRefreshBypass.includes(path))return forwardedResponse(request);
 const protectedRoute=isProtected(path),authOnlyRoute=isAuthOnly(path),access=request.cookies.get('madar-access-token')?.value,refresh=request.cookies.get('madar-refresh-token')?.value;
 if(access&&!expiresSoon(access)){const result=authOnlyRoute?authenticatedRedirect(request):forwardedResponse(request);rememberPath(result,request);return result;}
 if(access&&!tokenExpired(access)&&!isDocumentNavigation(request)){const result=forwardedResponse(request);rememberPath(result,request);return result;}
 if(refresh){
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(base&&key){
   const result=await refreshSession(base,key,refresh);
   if(result.kind==='refreshed')return refreshedResponse(request,result.session);
   if(result.kind==='unavailable')return recoveryPendingResponse(request);
  }else return recoveryPendingResponse(request);
  const result=protectedRoute?loginRedirect(request):NextResponse.next();clearSession(result);return result;
 }
 if(protectedRoute){const result=loginRedirect(request);clearSession(result);return result;}
 return NextResponse.next();
}

export const config={matcher:['/((?!_next/static|_next/image).*)']};
