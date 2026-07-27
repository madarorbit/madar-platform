import type {Connector,ConnectorManifest} from './contracts';
import {IntegrationError} from './errors';

const KEY_PATTERN=/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const VERSION_PATTERN=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function validateManifest(manifest:ConnectorManifest){
 if(!KEY_PATTERN.test(manifest.key))throw new IntegrationError('مفتاح الموصل يجب أن يكون ثابتًا ومكتوبًا بصيغة آمنة.','CONFIGURATION_ERROR',false,{connectorKey:manifest.key});
 if(!VERSION_PATTERN.test(manifest.version))throw new IntegrationError('إصدار الموصل يجب أن يتبع Semantic Versioning.','CONFIGURATION_ERROR',false,{connectorKey:manifest.key,version:manifest.version});
 if(!manifest.authSchemes.length)throw new IntegrationError('يجب أن يعلن الموصل عن طبقة مصادقة واحدة على الأقل.','CONFIGURATION_ERROR',false,{connectorKey:manifest.key});
 const streams=new Set<string>();
 for(const stream of manifest.streams){if(streams.has(stream.key))throw new IntegrationError('يوجد Stream مكرر داخل الموصل.','CONFIGURATION_ERROR',false,{connectorKey:manifest.key,streamKey:stream.key});streams.add(stream.key);}
}

export class ConnectorRegistry {
 private readonly connectors=new Map<string,Map<string,Connector>>();
 constructor(initial:readonly Connector[]=[]){for(const connector of initial)this.register(connector);}
 register(connector:Connector){
  validateManifest(connector.manifest);
  const versions=this.connectors.get(connector.manifest.key)||new Map<string,Connector>();
  if(versions.has(connector.manifest.version))throw new IntegrationError('تم تسجيل إصدار الموصل نفسه مسبقًا.','CONFIGURATION_ERROR',false,{connectorKey:connector.manifest.key,version:connector.manifest.version});
  versions.set(connector.manifest.version,connector);this.connectors.set(connector.manifest.key,versions);return this;
 }
 get(key:string,version?:string){
  const versions=this.connectors.get(key);if(!versions)throw new IntegrationError('الموصل المطلوب غير مسجل في مَدار.','CONNECTOR_NOT_FOUND',false,{connectorKey:key});
  if(version){const exact=versions.get(version);if(!exact)throw new IntegrationError('إصدار الموصل المطلوب غير متاح.','CONNECTOR_VERSION_MISMATCH',false,{connectorKey:key,version});return exact;}
  return [...versions.values()].sort((a,b)=>b.manifest.version.localeCompare(a.manifest.version,undefined,{numeric:true}))[0];
 }
 has(key:string,version?:string){try{this.get(key,version);return true;}catch{return false;}}
 list({includeInternal=false}:{includeInternal?:boolean}={}){return [...this.connectors.values()].flatMap(versions=>[...versions.values()]).filter(connector=>includeInternal||!connector.manifest.internalOnly).map(connector=>connector.manifest);}
}
