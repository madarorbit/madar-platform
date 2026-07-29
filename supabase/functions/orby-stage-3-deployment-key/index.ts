import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

declare const Deno:{
 env:{get(name:string):string|undefined};
 serve(handler:(request:Request)=>Response|Promise<Response>):void;
};

const EXPECTED_BUILD_TOKEN_SHA256='89169d50ee0d2d6aa723d4d6a4f043def7df5e65b87a20e593bf315be38cba17';
const encoder=new TextEncoder();

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

Deno.serve(async (request:Request)=>{
 if(request.method!=='POST')return Response.json({ok:false,error:'METHOD_NOT_ALLOWED'},{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 const authorization=request.headers.get('authorization')||'';
 const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
 const purpose=request.headers.get('x-madar-purpose')||'';
 if(!token||purpose!=='vercel-build'||!equal(await sha256(token),EXPECTED_BUILD_TOKEN_SHA256)){
  return Response.json({ok:false,error:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 }

 let serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()||'';
 if(!serviceRoleKey){
  try{
   const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}') as Record<string,string>;
   serviceRoleKey=String(secretKeys.default||'').trim();
  }catch{
   serviceRoleKey='';
  }
 }
 if(!serviceRoleKey)return Response.json({ok:false,error:'SERVICE_KEY_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});

 return Response.json({ok:true,serviceRoleKey},{headers:{'Cache-Control':'no-store','Content-Type':'application/json'}});
});
