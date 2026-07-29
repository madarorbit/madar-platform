import {OpenAICompatibleProvider,type OpenAICompatibleProviderOptions} from './openai';

export type OpenRouterProviderOptions=Omit<OpenAICompatibleProviderOptions,'id'|'displayName'|'baseUrl'|'headers'|'requestDefaults'> & {
 id?:string;
 displayName?:string;
 baseUrl?:string;
 siteUrl?:string;
 appName?:string;
 headers?:Record<string,string>;
};

export class OpenRouterProvider extends OpenAICompatibleProvider {
 constructor(options:OpenRouterProviderOptions){
  super({
   ...options,
   id:options.id||'openrouter',
   displayName:options.displayName||'OpenRouter',
   baseUrl:options.baseUrl||'https://openrouter.ai/api/v1',
   headers:{
    'HTTP-Referer':options.siteUrl||'https://www.orbitmadar.com',
    'X-OpenRouter-Title':options.appName||'MADAR | ORBIT',
    'X-OpenRouter-Metadata':'enabled',
    ...(options.headers||{}),
   },
   requestDefaults:{
    reasoning:{effort:'none',exclude:true},
    provider:{
     allow_fallbacks:true,
     require_parameters:true,
     data_collection:'deny',
    },
   },
  });
 }
}