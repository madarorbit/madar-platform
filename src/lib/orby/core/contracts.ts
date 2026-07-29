export type OrbyJsonPrimitive=string|number|boolean|null;
export type OrbyJsonValue=OrbyJsonPrimitive|OrbyJsonObject|OrbyJsonValue[];
export type OrbyJsonObject={ [key:string]:OrbyJsonValue };

export type OrbyMessageRole='system'|'user'|'assistant';
export type OrbyMessage={
 id:string;
 role:OrbyMessageRole;
 content:string;
 createdAt:string;
 metadata?:OrbyJsonObject;
};

export type OrbyIdentity={
 organizationId:string;
 userId:string;
 workspaceId?:string;
 locale?:string;
 timezone?:string;
};

export type OrbyProviderCapability='text'|'streaming'|'embeddings'|'moderation'|'vision'|'audio'|'json';
export type OrbyProviderCapabilities=Readonly<Record<OrbyProviderCapability,boolean>>;

export type OrbyUsage={
 inputTokens?:number;
 outputTokens?:number;
 totalTokens?:number;
 estimatedCost?:number;
 currency?:string;
};

export type OrbyReasoningEffort='max'|'xhigh'|'high'|'medium'|'low'|'minimal'|'none';
export type OrbyReasoningOptions={
 enabled?:boolean;
 effort?:OrbyReasoningEffort;
 maxTokens?:number;
 exclude?:boolean;
};

export type OrbyGenerationOptions={
 temperature?:number;
 maxOutputTokens?:number;
 topP?:number;
 stop?:readonly string[];
 responseFormat?:'text'|'json';
 timeoutMs?:number;
 reasoning?:OrbyReasoningOptions;
 metadata?:OrbyJsonObject;
};

export type OrbyProviderRequest={
 requestId:string;
 model:string;
 messages:readonly Pick<OrbyMessage,'role'|'content'>[];
 options:OrbyGenerationOptions;
 signal?:AbortSignal;
};

export type OrbyProviderResponse={
 text:string;
 finishReason?:string;
 providerRequestId?:string;
 usage?:OrbyUsage;
 rawMetadata?:OrbyJsonObject;
};

export type OrbyProviderStreamEvent=
 |{type:'start';providerRequestId?:string}
 |{type:'delta';text:string}
 |{type:'usage';usage:OrbyUsage}
 |{type:'end';finishReason?:string};

export type OrbyEmbeddingRequest={requestId:string;model:string;inputs:readonly string[];signal?:AbortSignal};
export type OrbyEmbeddingResponse={vectors:readonly number[][];usage?:OrbyUsage};
export type OrbyModerationRequest={requestId:string;model?:string;inputs:readonly string[];signal?:AbortSignal};
export type OrbyModerationResult={flagged:boolean;categories:Readonly<Record<string,boolean>>;scores?:Readonly<Record<string,number>>};
export type OrbyModelSummary={id:string;displayName?:string;contextWindow?:number;capabilities?:Partial<OrbyProviderCapabilities>};
export type OrbyProviderHealth={providerId:string;ok:boolean;latencyMs:number;checkedAt:string;message?:string};

export interface OrbyProvider {
 readonly id:string;
 readonly displayName:string;
 readonly capabilities:OrbyProviderCapabilities;
 generate(request:OrbyProviderRequest):Promise<OrbyProviderResponse>;
 stream(request:OrbyProviderRequest):AsyncIterable<OrbyProviderStreamEvent>;
 embeddings(request:OrbyEmbeddingRequest):Promise<OrbyEmbeddingResponse>;
 moderation(request:OrbyModerationRequest):Promise<readonly OrbyModerationResult[]>;
 models(signal?:AbortSignal):Promise<readonly OrbyModelSummary[]>;
 health(signal?:AbortSignal):Promise<OrbyProviderHealth>;
}

export type OrbyModelDescriptor={
 id:string;
 providerId:string;
 providerModel:string;
 displayName:string;
 enabled:boolean;
 priority:number;
 capabilities:Partial<OrbyProviderCapabilities>;
 contextWindow?:number;
 maxOutputTokens?:number;
 inputCostPerMillion?:number;
 outputCostPerMillion?:number;
 currency?:string;
 tags?:readonly string[];
 metadata?:OrbyJsonObject;
};

export type OrbyRoutingPolicy={
 preferredModelId?:string;
 allowedProviderIds?:readonly string[];
 allowedModelIds?:readonly string[];
 requiredCapabilities?:readonly OrbyProviderCapability[];
 maxEstimatedCost?:number;
 maxAttempts?:number;
 retryBaseDelayMs?:number;
};

export type OrbyRoutingSelection={model:OrbyModelDescriptor;provider:OrbyProvider};
export type OrbyRoutingAttempt={providerId:string;modelId:string;attempt:number;status:'succeeded'|'failed';errorCode?:string};
export type OrbyRoutedResponse={selection:OrbyRoutingSelection;response:OrbyProviderResponse;attempts:readonly OrbyRoutingAttempt[]};

export type OrbyContextSegment={
 key:string;
 title:string;
 content:string;
 priority:number;
 trusted:boolean;
 sensitive?:boolean;
 metadata?:OrbyJsonObject;
};

export type OrbyContextRequest={
 identity:OrbyIdentity;
 sessionId:string;
 message:string;
 metadata?:OrbyJsonObject;
 signal?:AbortSignal;
};

export interface OrbyContextSource {
 readonly key:string;
 readonly priority:number;
 load(request:OrbyContextRequest):Promise<OrbyContextSegment|null>;
}

export type OrbyCompiledPrompt={messages:readonly Pick<OrbyMessage,'role'|'content'>[];contextKeys:readonly string[];characterCount:number};

export interface OrbyPromptCompiler {
 compile(input:{systemPolicies:readonly string[];context:readonly OrbyContextSegment[];history:readonly OrbyMessage[];message:string;maxCharacters:number}):OrbyCompiledPrompt;
}

export type OrbySessionStatus='active'|'closed'|'expired';
export type OrbySession={
 id:string;
 organizationId:string;
 userId:string;
 workspaceId?:string;
 status:OrbySessionStatus;
 createdAt:string;
 updatedAt:string;
 expiresAt?:string;
 metadata?:OrbyJsonObject;
};

export interface OrbySessionStore {
 create(session:OrbySession):Promise<OrbySession>;
 get(sessionId:string):Promise<OrbySession|null>;
 save(session:OrbySession):Promise<OrbySession>;
 listMessages(sessionId:string,limit:number):Promise<readonly OrbyMessage[]>;
 appendMessages(sessionId:string,messages:readonly OrbyMessage[]):Promise<void>;
}

export type OrbyCapability={
 key:string;
 version:string;
 enabled:boolean;
 description:string;
 requiredProviderCapabilities?:readonly OrbyProviderCapability[];
 metadata?:OrbyJsonObject;
};

export type OrbyEventMap={
 'request.started':{requestId:string;organizationId:string;userId:string;sessionId:string};
 'request.completed':{requestId:string;organizationId:string;userId:string;sessionId:string;providerId:string;modelId:string;durationMs:number};
 'request.failed':{requestId:string;organizationId:string;userId:string;sessionId?:string;errorCode:string;durationMs:number};
 'provider.failed':{requestId:string;providerId:string;modelId:string;attempt:number;errorCode:string};
 'provider.switched':{requestId:string;fromProviderId:string;toProviderId:string;fromModelId:string;toModelId:string};
 'session.created':{sessionId:string;organizationId:string;userId:string};
 'session.closed':{sessionId:string;organizationId:string;userId:string};
 'health.checked':{providerId:string;ok:boolean;latencyMs:number};
};

export type OrbyEventName=keyof OrbyEventMap;
export type OrbyEventListener<K extends OrbyEventName>=(payload:OrbyEventMap[K])=>void|Promise<void>;

export interface OrbyEventBus {
 on<K extends OrbyEventName>(event:K,listener:OrbyEventListener<K>):()=>void;
 emit<K extends OrbyEventName>(event:K,payload:OrbyEventMap[K]):Promise<void>;
}

export interface OrbyLogger {
 debug(message:string,metadata?:OrbyJsonObject):void;
 info(message:string,metadata?:OrbyJsonObject):void;
 warn(message:string,metadata?:OrbyJsonObject):void;
 error(message:string,metadata?:OrbyJsonObject):void;
}

export type OrbyRuntimeConfiguration={
 enabled:boolean;
 defaultModelId?:string;
 maxContextCharacters:number;
 sessionHistoryLimit:number;
 sessionTtlSeconds:number;
 requestTimeoutMs:number;
 maxAttempts:number;
 retryBaseDelayMs:number;
 logLevel:'debug'|'info'|'warn'|'error'|'silent';
 allowedProviderIds?:readonly string[];
 allowedModelIds?:readonly string[];
 systemPolicies:readonly string[];
};

export type OrbyConfigurationScope={organizationId?:string};

export interface OrbyConfigurationStore {
 get(scope:OrbyConfigurationScope):Promise<Partial<OrbyRuntimeConfiguration>|null>;
 set(scope:OrbyConfigurationScope,value:Partial<OrbyRuntimeConfiguration>):Promise<void>;
}

export type OrbyKernelRequest={
 requestId?:string;
 identity:OrbyIdentity;
 sessionId?:string;
 message:string;
 preferredModelId?:string;
 requiredCapabilities?:readonly OrbyProviderCapability[];
 metadata?:OrbyJsonObject;
 signal?:AbortSignal;
};

export type OrbyKernelStreamEvent=
 |{type:'start';requestId:string;sessionId:string;providerId:string;modelId:string}
 |{type:'delta';text:string}
 |{type:'usage';usage:OrbyUsage}
 |{type:'end';response:OrbyKernelResponse};

export type OrbyKernelResponse={
 requestId:string;
 sessionId:string;
 text:string;
 providerId:string;
 modelId:string;
 usage?:OrbyUsage;
 attempts:readonly OrbyRoutingAttempt[];
 durationMs:number;
};