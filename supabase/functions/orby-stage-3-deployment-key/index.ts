import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

declare const Deno:{
 env:{get(name:string):string|undefined};
 serve(handler:(request:Request)=>Response|Promise<Response>):void;
};

const EXPECTED_BUILD_TOKEN_SHA256='89169d50ee0d2d6aa723d4d6a4f043def7df5e65b87a20e593bf315be38cba17';
const TEAM_SLUG='madar8';
const TEAM_ID='team_Bm3hXCdd9RlkPzL5IE0EEc5N';
const PROJECT_NAME='madar-platform';
const PROJECT_ID='prj_PrEUCOyLsPh5hcxFXlueAM1P8Xif';
const ALLOWED_ISSUERS=new Set([`https://oidc.vercel.com/${TEAM_SLUG}`,'https://oidc.vercel.com']);
const EXPECTED_AUDIENCE=`https://vercel.com/${TEAM_SLUG}`;
const EXPECTED_SUBJECT=`owner:${TEAM_SLUG}:project:${PROJECT_NAME}:environment:production`;
const encoder=new TextEncoder();

type JwtHeader={alg?:unknown;kid?:unknown;typ?:unknown};
type JwtPayload={iss?:unknown;aud?:unknown;sub?:unknown;exp?:unknown;nbf?:unknown;nfb?:unknown;iat?:unknown;owner?:unknown;owner_id?:unknown;project?:unknown;project_id?:unknown;environment?:unknown};
type Jwk=JsonWebKey&{kid?:string;alg?:string;use?:string};
type JwksResponse={keys?:Jwk[]};

async function sha256(value:string){
 const digest=await crypto.subtle.digest('SHA-256',encoder.encode(value));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

function equal(left:string,right:string){
 if(left.length!==right.length)return false;
 let difference=0;
 for(let index=0;index<left.length;index+=1)difference|=left.charCodeAt(index)^right.charCodeAt(index);
 return difference===0;
}

function base64UrlBytes(value:string){
 const normalized=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');
 const decoded=atob(normalized);
 return Uint8Array.from(decoded,character=>character.charCodeAt(0));
}

function decodeJson<T>(value:string):T{
 return JSON.parse(new TextDecoder().decode(base64UrlBytes(value))) as T;
}

function audienceMatches(value:unknown){
 return typeof value==='string'?value===EXPECTED_AUDIENCE:Array.isArray(value)&&value.some(item=>item===EXPECTED_AUDIENCE);
}

async function verifyVercelOidc(token:string){
 const parts=token.split('.');
 if(parts.length!==3)return false;
 let header:JwtHeader,payload:JwtPayload;
 try{
  header=decodeJson<JwtHeader>(parts[0]);
  payload=decodeJson<JwtPayload>(parts[1]);
 }catch{return false;}
 if(header.alg!=='RS256'||typeof header.kid!=='string'||String(header.typ||'jwt').toLowerCase()!=='jwt')return false;
 const issuer=typeof payload.iss==='string'?payload.iss:'';
 if(!ALLOWED_ISSUERS.has(issuer)||!audienceMatches(payload.aud)||payload.sub!==EXPECTED_SUBJECT)return false;
 if(payload.owner!==TEAM_SLUG||payload.owner_id!==TEAM_ID||payload.project!==PROJECT_NAME||payload.project_id!==PROJECT_ID||payload.environment!=='production')return false;
 const now=Math.floor(Date.now()/1000),exp=Number(payload.exp),notBefore=Number(payload.nbf??payload.nfb??0),issuedAt=Number(payload.iat);
 if(!Number.isFinite(exp)||!Number.isFinite(issuedAt)||exp<now-30||notBefore>now+30||issuedAt>now+60)return false;
 try{
  const jwksResponse=await fetch(`${issuer}/.well-known/jwks`,{headers:{Accept:'application/json'},cache:'no-store'});
  if(!jwksResponse.ok)return false;
  const jwks=await jwksResponse.json() as JwksResponse;
  const jwk=jwks.keys?.find(key=>key.kid===header.kid&&(!key.alg||key.alg==='RS256')&&(!key.use||key.use==='sig'));
  if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64UrlBytes(parts[2]),encoder.encode(`${parts[0]}.${parts[1]}`));
 }catch{return false;}
}

async function authorized(token:string,purpose:string){
 if(!token)return false;
 if(purpose==='vercel-build')return equal(await sha256(token),EXPECTED_BUILD_TOKEN_SHA256);
 if(purpose==='vercel-oidc-build')return verifyVercelOidc(token);
 return false;
}

Deno.serve(async (request:Request)=>{
 if(request.method!=='POST')return Response.json({ok:false,error:'METHOD_NOT_ALLOWED'},{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 const authorization=request.headers.get('authorization')||'';
 const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 const purpose=request.headers.get('x-madar-purpose')||'';
 if(!await authorized(token,purpose))return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});

 let serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()||'';
 if(!serviceRoleKey){
  try{
   const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}') as Record<string,string>;
   serviceRoleKey=String(secretKeys.default||'').trim();
  }catch{serviceRoleKey='';}
 }
 if(!serviceRoleKey)return Response.json({ok:false,error:'SERVICE_KEY_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
 return Response.json({ok:true,serviceRoleKey},{headers:{'Cache-Control':'no-store','Content-Type':'application/json'}});
});
