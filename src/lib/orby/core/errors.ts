import type {OrbyJsonObject} from './contracts';

export type OrbyErrorCode=
 |'ORBY_DISABLED'
 |'VALIDATION_ERROR'
 |'AUTHORIZATION_FAILED'
 |'SESSION_NOT_FOUND'
 |'SESSION_OWNERSHIP_MISMATCH'
 |'SESSION_CLOSED'
 |'PROVIDER_NOT_FOUND'
 |'MODEL_NOT_FOUND'
 |'NO_ELIGIBLE_MODEL'
 |'PROVIDER_UNAVAILABLE'
 |'PROVIDER_RATE_LIMITED'
 |'PROVIDER_TIMEOUT'
 |'PROVIDER_BAD_RESPONSE'
 |'UNSUPPORTED_CAPABILITY'
 |'CONTEXT_SOURCE_FAILED'
 |'PROMPT_TOO_LARGE'
 |'EMPTY_RESPONSE'
 |'INTERNAL_ERROR';

export class OrbyError extends Error {
 constructor(
  message:string,
  public readonly code:OrbyErrorCode,
  public readonly retryable=false,
  public readonly metadata:OrbyJsonObject={},
  options?:{cause?:unknown},
 ){
  super(message,options);
  this.name='OrbyError';
 }
}

export function isOrbyError(error:unknown):error is OrbyError{return error instanceof OrbyError;}

export function normalizeOrbyError(error:unknown,fallback:OrbyErrorCode='INTERNAL_ERROR'){
 if(error instanceof OrbyError)return error;
 if(error instanceof DOMException&&error.name==='AbortError')return new OrbyError('انتهت مهلة تنفيذ طلب أوربي.','PROVIDER_TIMEOUT',true,{}, {cause:error});
 if(error instanceof Error)return new OrbyError('تعذر على أوربي إكمال الطلب.',fallback,false,{name:error.name},{cause:error});
 return new OrbyError('تعذر على أوربي إكمال الطلب.',fallback,false);
}

export function publicOrbyError(error:unknown){
 const normalized=normalizeOrbyError(error);
 return {code:normalized.code,message:normalized.message,retryable:normalized.retryable};
}
