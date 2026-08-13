import 'server-only';
import {createHash} from 'node:crypto';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {IntegrationError} from '@/src/lib/integration/errors';

export type OrbyGuestUsage={tier:'guest';daily_limit:number;used:number;remaining:number;usage_date?:string;input_characters?:number};
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emptyUsage=():OrbyGuestUsage=>({tier:'guest',daily_limit:5,used:0,remaining:5,usage_date:new Date().toISOString().slice(0,10)});

const cookieValue=(headers:Headers)=>headers.get('cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith('madar-orby-guest='))?.slice('madar-orby-guest='.length)||'';
const visitorHash=(headers:Headers,id:string)=>{const ip=(headers.get('x-forwarded-for')||headers.get('x-real-ip')||'unknown').split(',')[0].trim(),ua=headers.get('user-agent')||'unknown';return createHash('sha256').update(`${id}|${ip}|${ua}`).digest('hex');};
const rawReason=(error:unknown)=>{if(error instanceof IntegrationError&&error.cause&&typeof error.cause==='object'){const value=error.cause as{message?:unknown};return typeof value.message==='string'?value.message:'';}return'';};

export async function reserveOrbyGuestRequest(headers:Headers,promptLength:number){
 const existing=cookieValue(headers),id=uuidPattern.test(existing)?existing:crypto.randomUUID();
 try{
  const usage=await new IntegrationDatabase().rpc<OrbyGuestUsage>('reserve_orby_guest_request',{visitor_hash:visitorHash(headers,id),submitted_characters:promptLength} as never);
  return{usage,id,isNew:id!==existing};
 }catch(error){if(rawReason(error).includes('ORBY_GUEST_DAILY_LIMIT'))throw new Error('ORBY_GUEST_DAILY_LIMIT');throw error;}
}

export async function readOrbyGuestUsage(headers:Headers):Promise<OrbyGuestUsage>{
 const id=cookieValue(headers);if(!uuidPattern.test(id))return emptyUsage();
 const params=new URLSearchParams({select:'requests,input_characters,usage_date',visitor_hash:`eq.${visitorHash(headers,id)}`,usage_date:`eq.${new Date().toISOString().slice(0,10)}`,limit:'1'});
 const row=(await new IntegrationDatabase().select<{requests:number;input_characters:number;usage_date:string}>('orby_guest_usage_daily',params))[0];
 if(!row)return emptyUsage();
 const used=Math.min(Math.max(Number(row.requests)||0,0),5);return{tier:'guest',daily_limit:5,used,remaining:Math.max(5-used,0),usage_date:row.usage_date,input_characters:Number(row.input_characters)||0};
}
