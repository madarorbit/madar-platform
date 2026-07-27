import type {JsonObject,JsonValue} from './contracts';

export type IntegrationErrorCode=
 |'CONFIGURATION_ERROR'
 |'FEATURE_DISABLED'
 |'CONNECTOR_NOT_FOUND'
 |'CONNECTOR_VERSION_MISMATCH'
 |'VALIDATION_ERROR'
 |'AUTHENTICATION_FAILED'
 |'AUTHORIZATION_FAILED'
 |'RATE_LIMITED'
 |'SOURCE_UNAVAILABLE'
 |'TIMEOUT'
 |'CONNECTION_NOT_FOUND'
 |'CHECKPOINT_CONFLICT'
 |'DUPLICATE_OPERATION'
 |'DATABASE_ERROR'
 |'INTERNAL_ERROR';

export class IntegrationError extends Error {
 readonly name='IntegrationError';
 constructor(
  message:string,
  readonly code:IntegrationErrorCode,
  readonly retryable:boolean,
  readonly details:JsonObject={},
  readonly cause?:unknown,
 ){super(message);}
}

function jsonSafe(value:unknown):JsonValue{
 if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
 if(Array.isArray(value))return value.map(jsonSafe);
 if(typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([key,item])=>[key,jsonSafe(item)]));
 return String(value);
}

export function asIntegrationError(error:unknown):IntegrationError{
 if(error instanceof IntegrationError)return error;
 if(error instanceof DOMException&&error.name==='AbortError')return new IntegrationError('انتهت مهلة عملية الربط.','TIMEOUT',true,{},error);
 if(error instanceof Error)return new IntegrationError('حدث خطأ داخلي أثناء تنفيذ عملية الربط.','INTERNAL_ERROR',false,{originalName:error.name},error);
 return new IntegrationError('حدث خطأ غير معروف أثناء تنفيذ عملية الربط.','INTERNAL_ERROR',false,{value:jsonSafe(error)});
}

export function publicError(error:unknown){
 const normalized=asIntegrationError(error);
 return {code:normalized.code,message:normalized.message,retryable:normalized.retryable};
}

export type BackoffPolicy={baseDelayMs:number;maxDelayMs:number;multiplier:number};
export const DEFAULT_BACKOFF_POLICY:BackoffPolicy={baseDelayMs:1_000,maxDelayMs:15*60_000,multiplier:2};

export function computeBackoffMs(attempt:number,policy:BackoffPolicy=DEFAULT_BACKOFF_POLICY,random:()=>number=Math.random){
 const safeAttempt=Math.max(1,attempt);
 const ceiling=Math.min(policy.maxDelayMs,policy.baseDelayMs*Math.pow(policy.multiplier,safeAttempt-1));
 return Math.max(0,Math.floor(ceiling*Math.min(1,Math.max(0,random()))));
}

export function retryAt(attempt:number,now=new Date(),policy:BackoffPolicy=DEFAULT_BACKOFF_POLICY){
 return new Date(now.getTime()+computeBackoffMs(attempt,policy)).toISOString();
}
