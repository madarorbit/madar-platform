export type JsonPrimitive=string|number|boolean|null;
export type JsonValue=JsonPrimitive|JsonObject|JsonValue[];
export type JsonObject={ [key:string]:JsonValue };

export type ConnectorAuthScheme='none'|'api_key'|'bearer'|'basic'|'oauth2'|'database'|'custom';
export type ConnectorSyncMode='initial'|'incremental';
export type ConnectorChannel='OAUTH'|'API_KEY'|'WEBHOOK'|'LOCAL_BRIDGE'|'FILE'|'DATABASE';
export type ConnectionMode='READ_ONLY'|'WRITE_LIMITED';
export type ConnectionStatus='draft'|'verifying'|'active'|'paused'|'error'|'disconnected'|'archived';
export type IntegrationJobType='connection.test'|'sync.initial'|'sync.incremental'|'pipeline.process_batch';
export type IntegrationJobStatus='queued'|'running'|'succeeded'|'dead'|'cancelled';

export type ConnectorStreamDefinition={
 key:string;
 label:string;
 description?:string;
 supportsInitial:boolean;
 supportsIncremental:boolean;
 defaultPageSize:number;
};

export type ConnectorCapabilities={
 read:boolean;
 write:boolean;
 webhooks:boolean;
 polling:boolean;
 files:boolean;
 database:boolean;
 localBridge:boolean;
};

export type ConnectorManifest={
 key:string;
 version:string;
 displayName:string;
 description:string;
 authSchemes:readonly ConnectorAuthScheme[];
 streams:readonly ConnectorStreamDefinition[];
 capabilities:ConnectorCapabilities;
 channels?:readonly ConnectorChannel[];
 supportedVerticals?:readonly ('commerce'|'food_service'|'hospitality')[];
 certification?:'draft'|'testing'|'certified'|'suspended'|'retired';
 setupSchema?:JsonObject;
 internalOnly?:boolean;
};

export type ConnectorValidationIssue={path:string;message:string};
export type ConnectorValidationResult={valid:true;normalizedConfig:JsonObject}|{valid:false;issues:ConnectorValidationIssue[]};

export type ConnectorConnection={
 id:string;
 organizationId:string;
 connectorKey:string;
 connectorVersion:string;
 name:string;
 status:ConnectionStatus;
 mode:ConnectionMode;
 config:JsonObject;
};

export type ConnectorCheckpoint={
 streamKey:string;
 cursor:JsonValue|null;
 watermark:string|null;
 version:number;
};

export type ConnectorLogger={
 debug(message:string,metadata?:JsonObject):void;
 info(message:string,metadata?:JsonObject):void;
 warn(message:string,metadata?:JsonObject):void;
 error(message:string,metadata?:JsonObject):void;
};

export type ConnectorContext={
 connection:ConnectorConnection;
 authScheme:ConnectorAuthScheme;
 secret:JsonObject;
 checkpoints:Readonly<Record<string,ConnectorCheckpoint|undefined>>;
 signal:AbortSignal;
 logger:ConnectorLogger;
};

export type ConnectionTestResult={
 ok:boolean;
 latencyMs:number;
 accountLabel?:string;
 grantedScopes?:string[];
 warnings?:string[];
 metadata?:JsonObject;
};

export type ConnectorSyncRequest={
 streams?:readonly string[];
 pageSize?:number;
 since?:string;
 until?:string;
};

export type ConnectorBatch={
 streamKey:string;
 records:readonly JsonObject[];
 nextCursor:JsonValue|null;
 watermark:string|null;
 hasMore:boolean;
 sourceRequestId?:string;
 metadata?:JsonObject;
};

export type ConnectorWriteCommand={id:string;resourceKey:string;commandType:string;entityType:string;entityId:string;desiredChange:JsonObject;expectedSourceVersion:string|null;idempotencyKey:string};
export type ConnectorWriteResult={ok:boolean;conflict?:boolean;sourceRequestId?:string;sourceVersion?:string;sourceSnapshot?:JsonObject;canonicalAfter?:JsonObject;compensationPayload?:JsonObject;warnings?:string[]};
export type ConnectorWriteVerification={verified:boolean;sourceVersion?:string;sourceSnapshot?:JsonObject;canonicalAfter?:JsonObject;reason?:string};

export interface Connector {
 readonly manifest:ConnectorManifest;
 validateConfig(input:unknown):ConnectorValidationResult;
 testConnection(context:ConnectorContext):Promise<ConnectionTestResult>;
 initialSync(context:ConnectorContext,request:ConnectorSyncRequest):AsyncIterable<ConnectorBatch>;
 incrementalSync(context:ConnectorContext,request:ConnectorSyncRequest):AsyncIterable<ConnectorBatch>;
 write?(context:ConnectorContext,command:ConnectorWriteCommand):Promise<ConnectorWriteResult>;
 verifyWrite?(context:ConnectorContext,command:ConnectorWriteCommand,result:ConnectorWriteResult):Promise<ConnectorWriteVerification>;
 compensate?(context:ConnectorContext,command:ConnectorWriteCommand,payload:JsonObject):Promise<ConnectorWriteResult>;
}

export type StoredIntegrationConnection={
 id:string;
 organization_id:string;
 connector_key:string;
 connector_version:string;
 name:string;
 status:ConnectionStatus;
 connection_mode:ConnectionMode;
 auth_scheme:ConnectorAuthScheme;
 config:JsonObject;
 last_tested_at:string|null;
 last_success_at:string|null;
 last_error_code:string|null;
 last_error_message:string|null;
 created_by:string;
 created_at:string;
 updated_at:string;
 deleted_at:string|null;
};

export type StoredIntegrationJob={
 id:string;
 organization_id:string;
 connection_id:string|null;
 job_type:IntegrationJobType;
 status:IntegrationJobStatus;
 payload:JsonObject;
 priority:number;
 available_at:string;
 attempts:number;
 max_attempts:number;
 idempotency_key:string|null;
 locked_by:string|null;
 lease_expires_at:string|null;
 created_by:string|null;
 created_at:string;
 updated_at:string;
};

export type StoredWriteCommand={id:string;organization_id:string;connection_id:string;command_type:string;resource_key:string;entity_type:string;entity_id:string;desired_change:JsonObject;preview:JsonObject;expected_source_version:string|null;idempotency_key:string;status:string;requested_by:string;requested_at:string;locked_by:string|null;lease_expires_at:string|null};

export type EncryptedSecret={
 ciphertext:string;
 iv:string;
 authTag:string;
 keyVersion:number;
 algorithm:'aes-256-gcm';
};
