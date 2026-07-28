import type {CreateOrbyFoundationOptions} from './index';
import {createOrbyFoundation} from './index';
import {providersFromEnvironment} from './providers';
import {SupabaseOrbyConfigurationStore,SupabaseOrbySessionStore,loadSupabaseOrbyModels} from './adapters/supabase';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {createEmbeddingService} from './intelligence/embedding';
import {OrbyKnowledgeContextSource,OrbyKnowledgeEngine} from './intelligence/knowledge';
import {IntelligenceAwareSessionStore,OrbyMemoryContextSource,OrbyMemoryEngine} from './intelligence/memory';
import {SupabaseOrbyIntelligenceRepository} from './intelligence/adapters/supabase';

export * from './index';
export * from './adapters/supabase';

export async function createServerOrbyFoundation(options:Omit<CreateOrbyFoundationOptions,'providers'|'models'|'sessionStore'|'configurationStore'>={}){
 const providers=providersFromEnvironment(),models=await loadSupabaseOrbyModels(),repository=new SupabaseOrbyIntelligenceRepository(new IntegrationDatabase()),baseSessions=new SupabaseOrbySessionStore();
 const memory=new OrbyMemoryEngine(repository),contextSources=[...(options.contextSources||[]),new OrbyMemoryContextSource(memory)];
 const embeddings=createEmbeddingService(providers,models),knowledge=new OrbyKnowledgeEngine(repository,embeddings);contextSources.push(new OrbyKnowledgeContextSource(knowledge));
 return createOrbyFoundation({...options,contextSources,providers,models,sessionStore:new IntelligenceAwareSessionStore(baseSessions,repository),configurationStore:new SupabaseOrbyConfigurationStore()});
}
