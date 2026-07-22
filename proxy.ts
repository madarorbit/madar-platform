import { NextRequest, NextResponse } from 'next/server';

const cookieOptions=(maxAge:number)=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge});

function expiresSoon(token:string) {
 try {
  const payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()) as {exp?:number};
  return !payload.exp || payload.exp <= Math.floor(Date.now()/1000)+60;
 } catch { return true; }
}

export async function proxy(request:NextRequest) {
 const access=request.cookies.get('madar-access-token')?.value;
 const refresh=request.cookies.get('madar-refresh-token')?.value;
 if(!refresh || (access && !expiresSoon(access))) return NextResponse.next();
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!key) return NextResponse.next();
 const response=await fetch(`${base}/auth/v1/token?grant_type=refresh_token`,{
  method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh})
 }).catch(()=>null);
 const result=NextResponse.next();
 if(!response?.ok){result.cookies.set('madar-access-token','',cookieOptions(0));result.cookies.set('madar-refresh-token','',cookieOptions(0));return result;}
 const session=await response.json() as {access_token:string;refresh_token:string;expires_in:number};
 result.cookies.set('madar-access-token',session.access_token,cookieOptions(session.expires_in||3600));
 result.cookies.set('madar-refresh-token',session.refresh_token,cookieOptions(60*60*24*30));
 return result;
}

export const config={matcher:['/admin/:path*','/account/:path*','/dashboard','/onboarding','/student/:path*','/workspace-payment/:path*']};
