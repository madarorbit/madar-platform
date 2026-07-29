import type {OrbyDomainPlugin,OrbyPluginInstallation,OrbyPluginManifest,OrbyOsScope} from './contracts';
import {COMPILED_ORBY_DOMAIN_PLUGINS,type CompiledOrbyDomainEntrypoint} from './domains';

const ENTRYPOINTS=new Map(Object.entries(COMPILED_ORBY_DOMAIN_PLUGINS));
function versionParts(value:string){const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(value);if(!match)throw new Error('ORBY_PLUGIN_VERSION_INVALID');return match.slice(1).map(Number);}
export function pluginCompatible(coreVersion:string,range:string){const [major]=versionParts(coreVersion);const match=/^\^(\d+)\.(\d+)\.(\d+)$/.exec(range);return Boolean(match&&Number(match[1])===major);}
function scopeKey(scope:OrbyOsScope){return[scope.environment||'*',scope.organizationId||'*',scope.workspaceId||'*',scope.userId||'*'].join(':');}

export class OrbyPluginRegistry{
 private readonly manifests=new Map<string,Map<string,OrbyPluginManifest>>();
 private readonly installations=new Map<string,OrbyPluginInstallation>();
 constructor(private readonly coreVersion='1.0.0'){}
 register(manifest:OrbyPluginManifest){if(!ENTRYPOINTS.has(manifest.entrypoint))throw new Error('ORBY_PLUGIN_ENTRYPOINT_NOT_COMPILED');if(!pluginCompatible(this.coreVersion,manifest.compatibleCore))throw new Error('ORBY_PLUGIN_CORE_INCOMPATIBLE');versionParts(manifest.version);const versions=this.manifests.get(manifest.key)||new Map<string,OrbyPluginManifest>();if(versions.has(manifest.version))throw new Error('ORBY_PLUGIN_VERSION_EXISTS');versions.set(manifest.version,Object.freeze({...manifest}));this.manifests.set(manifest.key,versions);return manifest;}
 resolve(pluginKey:string,version?:string):OrbyDomainPlugin{const versions=this.manifests.get(pluginKey);if(!versions)throw new Error('ORBY_PLUGIN_NOT_FOUND');const manifest=version?versions.get(version):[...versions.values()].sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}))[0];if(!manifest)throw new Error('ORBY_PLUGIN_VERSION_NOT_FOUND');const domain=ENTRYPOINTS.get(manifest.entrypoint);if(!domain)throw new Error('ORBY_PLUGIN_ENTRYPOINT_NOT_COMPILED');return domain;}
 install(pluginKey:string,version:string,scope:OrbyOsScope,configuration={}){const manifest=this.manifests.get(pluginKey)?.get(version);if(!manifest)throw new Error('ORBY_PLUGIN_NOT_FOUND');this.resolve(pluginKey,version);for(const [dependency,required] of Object.entries(manifest.dependencies)){const installed=[...this.installations.values()].find(item=>item.pluginKey===dependency&&item.status==='active'&&scopeKey(item.scope)===scopeKey(scope));if(!installed||!pluginCompatible(installed.version,required))throw new Error(`ORBY_PLUGIN_DEPENDENCY_MISSING:${dependency}`);}const installation:OrbyPluginInstallation={pluginKey,version,scope,status:'active',configuration,installedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};this.installations.set(`${scopeKey(scope)}:${pluginKey}`,installation);return installation;}
 disable(pluginKey:string,scope:OrbyOsScope){const key=`${scopeKey(scope)}:${pluginKey}`,current=this.installations.get(key);if(!current)throw new Error('ORBY_PLUGIN_INSTALLATION_NOT_FOUND');const updated={...current,status:'paused' as const,updatedAt:new Date().toISOString()};this.installations.set(key,updated);return updated;}
 rollback(pluginKey:string,targetVersion:string,scope:OrbyOsScope){const current=this.installations.get(`${scopeKey(scope)}:${pluginKey}`);if(!current)throw new Error('ORBY_PLUGIN_INSTALLATION_NOT_FOUND');return this.install(pluginKey,targetVersion,scope,current.configuration);}
 manifestsList(){return[...this.manifests.values()].flatMap(item=>[...item.values()]);}
 installationsList(){return[...this.installations.values()];}
 compiledEntrypoints(){return[...ENTRYPOINTS.keys()] as CompiledOrbyDomainEntrypoint[];}
}

export function builtinDomainPlugins():readonly OrbyDomainPlugin[]{return Object.values(COMPILED_ORBY_DOMAIN_PLUGINS);}
export function builtinPluginManifests():readonly OrbyPluginManifest[]{return builtinDomainPlugins().map(domain=>({id:`orby.${domain.key}`,key:`orby.${domain.key}`,name:domain.name,description:domain.description,kind:'domain',version:'1.0.0',compatibleCore:'^1.0.0',entrypoint:`@madar/orby-${domain.key}`,permissions:domain.permissions,tools:domain.tools,events:[],workflows:domain.workflows,knowledgeSources:domain.knowledgeNamespaces,dependencies:{},requirements:['orby-os-v1'],isolation:'data',enabledByDefault:true,metadata:{domain:domain.key}}));}
