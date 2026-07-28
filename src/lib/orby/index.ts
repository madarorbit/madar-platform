export * from './core/contracts';
export * from './core/errors';
export * from './core/runtime';
export * from './providers';
export * from './kernel';
export * from './adapters/integration';

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
  .register({key:'tools',version:'0.0.0',enabled:false,description:'تنفيذ الأدوات مؤجل للمرحلة الثانية'})
  .register({key:'long-term-memory',version:'0.0.0',enabled:false,description:'الذاكرة طويلة المدى مؤجلة للمرحلة الثالثة'});
 const configurationStore=options.configurationStore||new InMemoryConfigurationStore(),configuration=new OrbyConfigurationManager(configurationStore);
 if(options.configuration)configuration.setRuntimeOverride({},options.configuration);
 const context=new OrbyContextEngine(logger);for(const source of options.contextSources||[])context.register(source);
 const sessionStore=options.sessionStore||new InMemorySessionStore(),sessions=new OrbySessionManager(sessionStore,events),routing=new OrbyRoutingEngine(providerRegistry,modelRegistry,events,logger),health=new OrbyHealthMonitor(providerRegistry,events,logger);
 const kernel=new OrbyKernel({configuration,sessions,context,routing,events,logger});
 return {kernel,configuration,configurationStore,providers:providerRegistry,models:modelRegistry,capabilities,context,sessions,sessionStore,routing,health,events,logger};
}
