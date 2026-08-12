import 'server-only';
import type {CreateOrbyFoundationOptions} from './index';
import {createOrbyFoundation} from './index';
import {providersFromEnvironment} from './providers';
import {loadSupabaseOrbyModels} from './adapters/supabase';
import {IntegrationDatabase} from '@/src/lib/integration/platform';

/**
 * ORBY account/guest foundation.
 * Uses the same provider/model registry as ORBY Core, but keeps kernel sessions
 * in memory because a general account/guest conversation is not a workspace.
 * Persistent account conversations are stored explicitly by the application
 * layer with strict user RLS; workspace sessions still use createServerOrbyFoundation.
 */
export async function createAccountOrbyFoundation(options:CreateOrbyFoundationOptions={}){
 const database=new IntegrationDatabase();
 const providers=providersFromEnvironment();
 const models=await loadSupabaseOrbyModels(database);
 return createOrbyFoundation({...options,providers,models});
}
