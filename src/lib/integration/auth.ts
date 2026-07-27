import type {ConnectorAuthScheme,JsonObject} from './contracts';
import {IntegrationError} from './errors';

type HttpAuthResult={url:URL;headers:Headers};
export type AuthStrategy={
 scheme:ConnectorAuthScheme;
 validate(input:unknown):JsonObject;
 applyHttp?(url:URL,headers:Headers,secret:JsonObject):HttpAuthResult;
};

function object(input:unknown):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new IntegrationError('بيانات المصادقة غير صالحة.','VALIDATION_ERROR',false);
 return input as Record<string,unknown>;
}
function requiredString(value:unknown,label:string){
 if(typeof value!=='string'||!value.trim())throw new IntegrationError(`حقل ${label} مطلوب في بيانات المصادقة.`,'VALIDATION_ERROR',false);
 return value.trim();
}
function optionalString(value:unknown){return typeof value==='string'&&value.trim()?value.trim():undefined;}
function restrictedHeader(name:string){return ['host','content-length','connection','cookie','set-cookie'].includes(name.toLowerCase());}

const strategies:Record<ConnectorAuthScheme,AuthStrategy>={
 none:{scheme:'none',validate:()=>({})},
 api_key:{
  scheme:'api_key',
  validate(input){const value=object(input),placement=value.placement==='query'?'query':'header',name=requiredString(value.name,'اسم المفتاح');if(placement==='header'&&restrictedHeader(name))throw new IntegrationError('اسم ترويسة مفتاح API غير مسموح.','VALIDATION_ERROR',false);return {name,value:requiredString(value.value,'قيمة المفتاح'),placement};},
  applyHttp(url,headers,secret){const name=String(secret.name),value=String(secret.value);if(secret.placement==='query')url.searchParams.set(name,value);else headers.set(name,value);return {url,headers};},
 },
 bearer:{
  scheme:'bearer',
  validate(input){return {token:requiredString(object(input).token,'رمز Bearer')};},
  applyHttp(url,headers,secret){headers.set('Authorization',`Bearer ${String(secret.token)}`);return {url,headers};},
 },
 basic:{
  scheme:'basic',
  validate(input){const value=object(input);return {username:requiredString(value.username,'اسم المستخدم'),password:requiredString(value.password,'كلمة المرور')};},
  applyHttp(url,headers,secret){headers.set('Authorization',`Basic ${Buffer.from(`${String(secret.username)}:${String(secret.password)}`).toString('base64')}`);return {url,headers};},
 },
 oauth2:{
  scheme:'oauth2',
  validate(input){const value=object(input),expiresAt=optionalString(value.expiresAt),refreshToken=optionalString(value.refreshToken),scope=optionalString(value.scope);return {accessToken:requiredString(value.accessToken,'رمز OAuth'),...(refreshToken?{refreshToken}:{}),...(expiresAt?{expiresAt}:{}),...(scope?{scope}:{}),tokenType:optionalString(value.tokenType)||'Bearer'};},
  applyHttp(url,headers,secret){headers.set('Authorization',`${String(secret.tokenType||'Bearer')} ${String(secret.accessToken)}`);return {url,headers};},
 },
 database:{
  scheme:'database',
  validate(input){const value=object(input),engine=value.engine==='mysql'?'mysql':'postgres',port=Number(value.port|| (engine==='mysql'?3306:5432));if(!Number.isInteger(port)||port<1||port>65535)throw new IntegrationError('منفذ قاعدة البيانات غير صالح.','VALIDATION_ERROR',false);return {engine,host:requiredString(value.host,'مضيف قاعدة البيانات'),port,database:requiredString(value.database,'اسم قاعدة البيانات'),username:requiredString(value.username,'اسم مستخدم قاعدة البيانات'),password:requiredString(value.password,'كلمة مرور قاعدة البيانات'),ssl:value.ssl!==false};},
 },
 custom:{scheme:'custom',validate(input){return object(input) as JsonObject;}},
};

export function getAuthStrategy(scheme:ConnectorAuthScheme){return strategies[scheme];}
export function validateAuthPayload(scheme:ConnectorAuthScheme,input:unknown){return getAuthStrategy(scheme).validate(input);}
export function applyHttpAuthentication(rawUrl:string,init:RequestInit,scheme:ConnectorAuthScheme,secret:JsonObject){
 const url=new URL(rawUrl),headers=new Headers(init.headers),strategy=getAuthStrategy(scheme);
 const result=strategy.applyHttp?strategy.applyHttp(url,headers,secret):{url,headers};
 return {url:result.url.toString(),init:{...init,headers:result.headers}};
}
export function oauthTokenExpiresSoon(secret:JsonObject,windowSeconds=300){
 if(typeof secret.expiresAt!=='string')return false;
 const expires=Date.parse(secret.expiresAt);
 return Number.isFinite(expires)&&expires<=Date.now()+windowSeconds*1000;
}
