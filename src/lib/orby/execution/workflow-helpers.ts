import type {OrbyJsonObject,OrbyJsonValue} from '../core/contracts';
import type {OrbyWorkflowNode} from './contracts';
import {OrbyExecutionError} from './errors';

export function now(){return new Date().toISOString();}
export function sleep(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{if(ms<=0)return resolve();const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});}
export function errorResult(error:OrbyExecutionError){return{ok:false,data:null,error:{code:error.code,message:error.message,retryable:error.retryable,details:error.details}} as const;}

export function getPath(root:unknown,path:string):unknown{let current=root;for(const part of path.split('.').filter(Boolean)){if(current===null||current===undefined)return undefined;if(Array.isArray(current)&&/^\d+$/.test(part))current=current[Number(part)];else if(typeof current==='object')current=(current as Record<string,unknown>)[part];else return undefined;}return current;}
export function template(value:OrbyJsonValue,environment:OrbyJsonObject):OrbyJsonValue{
 if(Array.isArray(value))return value.map(item=>template(item,environment));
 if(value&&typeof value==='object'){
  const entries=Object.entries(value);if(entries.length===1&&entries[0][0]==='$ref'&&typeof entries[0][1]==='string')return (getPath(environment,entries[0][1])??null) as OrbyJsonValue;
  return Object.fromEntries(entries.map(([key,item])=>[key,template(item,environment)]));
 }
 if(typeof value==='string')return value.replace(/\{\{([^}]+)}}/g,(_,path)=>String(getPath(environment,String(path).trim())??''));
 return value;
}
export function condition(expression:Extract<OrbyWorkflowNode,{type:'condition'}>['condition'],environment:OrbyJsonObject):boolean{
 switch(expression.operator){
  case'and':return expression.conditions.every(item=>condition(item,environment));
  case'or':return expression.conditions.some(item=>condition(item,environment));
  case'not':return!condition(expression.condition,environment);
  case'exists':{const actual=getPath(environment,expression.path);return actual!==undefined&&actual!==null;}
  case'equals':return JSON.stringify(getPath(environment,expression.path))===JSON.stringify(expression.value);
  case'not_equals':return JSON.stringify(getPath(environment,expression.path))!==JSON.stringify(expression.value);
  case'greater_than':return Number(getPath(environment,expression.path))>Number(expression.value);
  case'less_than':return Number(getPath(environment,expression.path))<Number(expression.value);
 }
}
