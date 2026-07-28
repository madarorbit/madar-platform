export * from './core/contracts';
export * from './core/errors';
export * from './core/runtime';
export * from './providers';
export * from './kernel';
export * from './adapters/integration';
export * from './execution';
export * from './intelligence';

import type {OrbyConfigurationStore,OrbyContextSource,OrbyLogger,OrbyModelDescriptor,OrbyProvider,OrbyRuntimeConfiguration,OrbySessionStore} from './core/contracts';
import {
 DefaultOrbyEventBus,InMemoryConfigurationStore,InMemorySessionStore,OrbyCapabilityRegistry,OrbyConfigurationManager,OrbyContextEngine,
 OrbyHealthMonitor,OrbyModelRegistry,OrbyProviderRegistry,OrbyRoutingEngine,OrbySessionManager,RedactingLogger,
} from './core/runtime';
import {OrbyKernel} from './kernel';

export type CreateOrbyFoundationOptions={
 providers?:readonly OrbyProvider[];
 models?:readonly OrbyModelDescriptor[];
 contextSources?:readonly OrbyContextSource[];
 sessionStore?:OrbySessionStore;
 configurationStore?:OrbyConfigurationStore;
 logger?:OrbyLogger;
 configuration?:Partial<OrbyRuntimeConfiguration>;
};

export function createOrbyFoundation(options:CreateOrbyFoundationOptions={}){
 const logger=options.logger||new RedactingLogger(options.configuration?.logLevel||'info');
 const events=new DefaultOrbyEventBus(),providerRegistry=new OrbyProviderRegistry(),modelRegistry=new OrbyModelRegistry(),capabilities=new OrbyCapabilityRegistry();
 for(const provider of options.providers||[])providerRegistry.register(provider);
 for(const model of options.models||[])modelRegistry.register(model);
 capabilities
  .register({key:'chat',version:'1.0.0',enabled:true,description:'المحادثة النصية الأساسية',requiredProviderCapabilities:['text']})
  .register({key:'streaming',version:'1.0.0',enabled:true,description:'البث التدريجي للاستجابات',requiredProviderCapabilities:['text','streaming']})
  .register({key:'embeddings',version:'1.0.0',enabled:true,description:'التضمينات الدلالية',requiredProviderCapabilities:['embeddings']})
  .register({key:'moderation',version:'1.0.0',enabled:true,description:'فحص سلامة المدخلات والمخرجات',requiredProviderCapabilities:['moderation']})
  .register({key:'tools',version:'1.0.0',enabled:true,description:'طبقة تنفيذ أدوات ORBY مبنية وتبقى خاضعة لإعدادات التنفيذ وسياساته',metadata:{gatedBy:'orby_execution_config.enabled'}})
  .register({key:'conversation-memory',version:'1.0.0',enabled:true,description:'نافذة المحادثة والتلخيص والذاكرة قصيرة المدى',metadata:{gatedBy:'orby_memory_policies.enabled'}})
  .register({key:'long-term-memory',version:'1.0.0',enabled:true,description:'ذاكرة طويلة المدى مقيدة بالموافقة وسياسة الاحتفاظ',metadata:{gatedBy:'orby_memory_policies.allowLongTerm'}})
  .register({key:'knowledge-rag',version:'1.0.0',enabled:true,description:'فهم المستندات والبحث الدلالي وRAG والاستشهادات',metadata:{embeddingFallback:'orby-local-hash-embedding-v1',gatedBy:'knowledge source readiness'}})
  .register({key:'proactive-intelligence',version:'1.0.0',enabled:true,description:'الكواشف والاستباقية والتقارير الدورية',metadata:{gatedBy:'orby_intelligence_schedules.enabled'}})
  .register({key:'approved-proactive-actions',version:'1.0.0',enabled:true,description:'تحويل Insights إلى خطط تبدأ بموافقة صريحة عبر طبقة التنفيذ',metadata:{gatedBy:'orby_execution_config.enabled'}});
 const configurationStore=options.configurationStore||new InMemoryConfigurationStore(),configuration=new OrbyConfigurationManager(configurationStore);
 if(options.configuration)configuration.setRuntimeOverride({},options.configuration);
 const context=new OrbyContextEngine(logger);for(const source of options.contextSources||[])context.register(source);
 const sessionStore=options.sessionStore||new InMemorySessionStore(),sessions=new OrbySessionManager(sessionStore,events),routing=new OrbyRoutingEngine(providerRegistry,modelRegistry,events,logger),health=new OrbyHealthMonitor(providerRegistry,events,logger);
 const kernel=new OrbyKernel({configuration,sessions,context,routing,events,logger});
 return {kernel,configuration,configurationStore,providers:providerRegistry,models:modelRegistry,capabilities,context,sessions,sessionStore,routing,health,events,logger};
}
