const OFFICIAL_SITE_URL = 'https://www.orbitmadar.com';

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rybzdpduwgnsjofolini.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_L4P1zdLREZ_9KR3Bew8zkQ_81_h9iyx';
  if (!url || !key) throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  return { url: url.replace(/\/$/, ''), key };
}
export function integrationDatabaseConfig(fallbackServiceRoleKey?:string){const {url}=supabaseConfig();const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY||fallbackServiceRoleKey;if(!serviceRoleKey)throw new Error('Integration database access is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.');return {url,serviceRoleKey};}
export function integrationSecretsConfig(){const masterKey=process.env.MADAR_INTEGRATION_MASTER_KEY;const keyVersion=Number(process.env.MADAR_INTEGRATION_KEY_VERSION||'1');if(!masterKey)throw new Error('Integration secret encryption is not configured. Set MADAR_INTEGRATION_MASTER_KEY.');if(!Number.isInteger(keyVersion)||keyVersion<1)throw new Error('MADAR_INTEGRATION_KEY_VERSION must be a positive integer.');return {masterKey,keyVersion};}
export function integrationWorkerConfig(){const secret=process.env.MADAR_INTEGRATION_WORKER_SECRET||process.env.CRON_SECRET;if(!secret)throw new Error('Integration worker authentication is not configured. Set MADAR_INTEGRATION_WORKER_SECRET or CRON_SECRET.');return {secret};}
export function orbyAgentWorkerConfig(){const secret=process.env.MADAR_ORBY_WORKER_SECRET||process.env.MADAR_INTEGRATION_WORKER_SECRET||process.env.CRON_SECRET;if(!secret)throw new Error('ORBY agent worker authentication is not configured. Set MADAR_ORBY_WORKER_SECRET, MADAR_INTEGRATION_WORKER_SECRET or CRON_SECRET.');return {secret};}

export type OrbyOcrConfig=
 |{provider:'mistral';apiKey:string;model:string;baseUrl?:string;timeoutMs:number;maxBytes:number}
 |{provider:'http';endpoint:string;apiKey?:string};

function positiveInteger(value:string|undefined,fallback:number){const parsed=Number(value||fallback);return Number.isInteger(parsed)&&parsed>0?parsed:fallback;}
export function orbyOcrConfig():OrbyOcrConfig|null{
 const provider=process.env.ORBY_OCR_PROVIDER?.trim().toLowerCase();
 const mistralApiKey=process.env.ORBY_MISTRAL_OCR_API_KEY?.trim()||process.env.MISTRAL_API_KEY?.trim();
 if(provider==='mistral'||(!provider&&mistralApiKey)){
  if(!mistralApiKey)throw new Error('Mistral OCR is selected but ORBY_MISTRAL_OCR_API_KEY is missing.');
  const baseUrl=process.env.ORBY_MISTRAL_OCR_BASE_URL?.trim();if(baseUrl)try{new URL(baseUrl);}catch{throw new Error('ORBY_MISTRAL_OCR_BASE_URL must be a valid URL.');}
  return{provider:'mistral',apiKey:mistralApiKey,model:process.env.ORBY_OCR_MODEL?.trim()||'mistral-ocr-2512',baseUrl,timeoutMs:positiveInteger(process.env.ORBY_OCR_TIMEOUT_MS,55_000),maxBytes:positiveInteger(process.env.ORBY_OCR_MAX_BYTES,20*1024*1024)};
 }
 const endpoint=process.env.ORBY_OCR_ENDPOINT?.trim();
 if(!endpoint){if(provider&&provider!=='http')throw new Error(`Unsupported ORBY_OCR_PROVIDER: ${provider}`);return null;}
 try{new URL(endpoint);}catch{throw new Error('ORBY_OCR_ENDPOINT must be a valid URL.');}
 return{provider:'http',endpoint,apiKey:process.env.ORBY_OCR_API_KEY?.trim()||undefined};
}
export const siteUrl = () => (process.env.NODE_ENV === 'production'?OFFICIAL_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
