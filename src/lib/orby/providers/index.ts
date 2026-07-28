import type {OrbyProvider} from '../core/contracts';
import {AnthropicProvider} from './anthropic';
import {GeminiProvider} from './gemini';
import {LocalOpenAIProvider,OpenAICompatibleProvider} from './openai';

export * from './common';
export * from './mock';
export * from './openai';
export * from './anthropic';
export * from './gemini';

export function providersFromEnvironment(env:Record<string,string|undefined>=process.env){
 const providers:OrbyProvider[]=[];
 if(env.ORBY_OPENAI_API_KEY)providers.push(new OpenAICompatibleProvider({apiKey:env.ORBY_OPENAI_API_KEY,baseUrl:env.ORBY_OPENAI_BASE_URL,id:env.ORBY_OPENAI_PROVIDER_ID||'openai'}));
 if(env.ORBY_ANTHROPIC_API_KEY)providers.push(new AnthropicProvider({apiKey:env.ORBY_ANTHROPIC_API_KEY,baseUrl:env.ORBY_ANTHROPIC_BASE_URL}));
 if(env.ORBY_GEMINI_API_KEY)providers.push(new GeminiProvider({apiKey:env.ORBY_GEMINI_API_KEY,baseUrl:env.ORBY_GEMINI_BASE_URL}));
 if(env.ORBY_LOCAL_LLM_BASE_URL)providers.push(new LocalOpenAIProvider({baseUrl:env.ORBY_LOCAL_LLM_BASE_URL,apiKey:env.ORBY_LOCAL_LLM_API_KEY,id:env.ORBY_LOCAL_LLM_PROVIDER_ID||'local'}));
 return providers;
}
