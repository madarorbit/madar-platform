import type {CreateOrbyFoundationOptions} from './index';
import {createOrbyFoundation} from './index';
import {providersFromEnvironment} from './providers';
import {SupabaseOrbyConfigurationStore,SupabaseOrbySessionStore,loadSupabaseOrbyModels} from './adapters/supabase';

export * from './index';
export * from './adapters/supabase';

export async function createServerOrbyFoundation(options:Omit<CreateOrbyFoundationOptions,'providers'|'models'|'sessionStore'|'configurationStore'>={}){
 const [models]=await Promise.all([loadSupabaseOrbyModels()]);
 return createOrbyFoundation({...options,providers:providersFromEnvironment(),models,sessionStore:new SupabaseOrbySessionStore(),configurationStore:new SupabaseOrbyConfigurationStore()});
}
