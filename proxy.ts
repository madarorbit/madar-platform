import {NextRequest,NextResponse} from 'next/server';

const SESSION_MAX_AGE=60*60*24*365;
const cookieOptions=(maxAge:number,httpOnly=true)=>({httpOnly,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge});
const maintenanceAllowed=['/maintenance','/login','/auth','/admin','/api/health','/_next','/favicon','/robots.txt','/sitemap.xml'];
const sessionProtected=['/admin','/account','/dashboard','/onboarding','/student','/workspace','/workspace-payment'];

type JwtPayload={exp?:number;sub?:string};
function jwtPayload(token:string):JwtPayload{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()) as JwtPayload}catch{return{}}}
function expiresSoon(token:string){const payload=jwtPayload(token);return !payload.exp||payload.exp<=Math.floor(Date.now()/1000)+300}
function isProtected(path:string){return sessionProtected.some(prefix=>path===prefix||path.startsWith(`${prefix}/`))}
function loginRedirect(request:NextRequest){const target=request.nextUrl.clone(),next=`${request.nextUrl.pathname}${request.nextUrl.search}`;target.pathname='/login';target.search='';target.searchParams.set('next',next);return NextResponse.redirect(target)}
function clearSession(response:NextResponse){response.cookies.set('madar-access-token','',cookieOptions(0));response.cookies.set('madar-refresh-token','',cookieOptions(0));}
function rememberPath(response:NextResponse,request:NextRequest){if(isProtected(request.nextUrl.pathname)){const value=`${request.nextUrl.pathname}${request.nextUrl.search}`;response.cookies.set('madar-last-path',encodeURIComponent(value),cookieOptions(SESSION_MAX_AGE,false));}}
function forwardedResponse(request:NextRequest){return NextResponse.next({request:{headers:new Headers(request.headers)}})}
function setSessionCookies(response:NextResponse,session:{access_token:string;refresh_token:string;expires_in:number}){response.cookies.set('madar-access-token',session.access_token,cookieOptions(session.expires_in||3600));response.cookies.set('madar-refresh-token',session.refresh_token,cookieOptions(SESSION_MAX_AGE));response.headers.set('Cache-Control','private, no-store');}
function refreshedResponse(request:NextRequest,session:{access_token:string;refresh_token:string;expires_in:number}){request.cookies.set('madar-access-token',session.access_token);request.cookies.set('madar-refresh-token',session.refresh_token);const result=forwardedResponse(request);setSessionCookies(result,session);rememberPath(result,request);return result;}

async function reonboardingRedirect(request:NextRequest,token:string){
 const path=request.nextUrl.pathname;if(!isProtected(path)||path==='/account/setup'||path.startsWith('/account/setup/'))return null;
 const payload=jwtPayload(token);if(!payload.sub)return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!base||!key)return null;
 try{const response=await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(payload.sub)}&select=role,reonboarding_required&limit=1`,{headers:{apikey:key,Authorization:`Bearer ${token}`},cache:'no-store'}),rows=await response.json();const profile=rows?.[0];if(response.ok&&profile?.role!=='SUPER_ADMIN'&&profile?.reonboarding_required){const target=request.nextUrl.clone();target.pathname='/account/setup';target.search='';return NextResponse.redirect(target)}}catch{}
 return null;
}

async function maintenanceRedirect(request:NextRequest){
 const path=request.nextUrl.pathname;if(maintenanceAllowed.some(prefix=>path.startsWith(prefix))||/\.[a-z0-9]+$/i.test(path))return null;
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!base||!key)return null;
 try{const response=await fetch(`${base.replace(/\/$/,'')}/rest/v1/platform_settings?id=eq.1&select=maintenance_mode`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:30}}),settings=await response.json();if(response.ok&&settings?.[0]?.maintenance_mode){const target=request.nextUrl.clone();target.pathname='/maintenance';target.search='';return NextResponse.redirect(target)}}catch{}
 return null;
}

export async function proxy(request:NextRequest){
 const maintenance=await maintenanceRedirect(request);if(maintenance)return maintenance;
 const path=request.nextUrl.pathname,protectedRoute=isProtected(path),access=request.cookies.get('madar-access-token')?.value,refresh=request.cookies.get('madar-refresh-token')?.value;
 if(access&&!expiresSoon(access)){const forced=await reonboardingRedirect(request,access);if(forced)return forced;const result=NextResponse.next();rememberPath(result,request);return result;}
 if(refresh){
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(base&&key){const response=await fetch(`${base}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh}),cache:'no-store'}).catch(()=>null);if(response?.ok){const session=await response.json() as {access_token:string;refresh_token:string;expires_in:number};const forced=await reonboardingRedirect(request,session.access_token);if(forced){setSessionCookies(forced,session);return forced}return refreshedResponse(request,session);}}
  const result=protectedRoute?loginRedirect(request):NextResponse.next();clearSession(result);return result;
 }
 if(protectedRoute){const result=loginRedirect(request);clearSession(result);return result;}
 return NextResponse.next();
}

export const config={matcher:['/((?!_next/static|_next/image).*)']};
