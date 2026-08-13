import 'server-only';
import type {CreateOrbyFoundationOptions} from './index';
import {createOrbyFoundation} from './index';
import {providersFromEnvironment} from './providers';
import {loadSupabaseOrbyModels,SupabaseOrbyConfigurationStore} from './adapters/supabase';
import {IntegrationDatabase} from '@/src/lib/integration/platform';

/**
 * ORBY account/guest foundation.
 * Uses the same provider/model registry and global governed runtime configuration
 * as ORBY Core, but keeps kernel sessions in memory because a general account/guest
 * conversation is not a business workspace. Persistent registered conversations
 * are stored explicitly by the application layer with strict user RLS.
 */
export async function createAccountOrbyFoundation(options:CreateOrbyFoundationOptions={}){
 const database=new IntegrationDatabase();
 const providers=providersFromEnvironment();
 const models=await loadSupabaseOrbyModels(database);
 return createOrbyFoundation({...options,providers,models,configurationStore:new SupabaseOrbyConfigurationStore(database)});
}
