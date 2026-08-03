import type {OrbyJsonObject,OrbyUsage} from '../core/contracts';
import type {OrbyDialogueDecision} from '../personality/contracts';

export type OrbyConversationStatus='active'|'archived'|'deleted';
export type OrbyConversationMessageRole='user'|'assistant'|'tool'|'system';
export type OrbyConversationMessageStatus='sending'|'streaming'|'completed'|'failed'|'stopped';
export type OrbyConversationPart=
 |{type:'text';text:string}
 |{type:'citation';label:string;source:string;href?:string;lastSyncedAt?:string;certainty:'confirmed'|'estimated'}
 |{type:'tool';toolName:string;title:string;status:'preview'|'waiting_approval'|'running'|'verified'|'failed';input?:OrbyJsonObject;result?:OrbyJsonObject}
 |{type:'approval';approvalId?:string;title:string;summary:string;changes:readonly {field:string;before?:string;after?:string}[];expiresAt?:string}
 |{type:'result';title:string;status:'success'|'partial'|'failed';summary:string;recordHref?:string};

export type OrbyConversationMessage={
 id:string;
 conversationId:string;
 role:OrbyConversationMessageRole;
 status:OrbyConversationMessageStatus;
 parts:readonly OrbyConversationPart[];
 createdAt:string;
 updatedAt:string;
 metadata:OrbyJsonObject;
};

export type OrbyConversationThread={
 id:string;
 organizationId:string;
 workspaceId?:string;
 userId:string;
 title:string;
 status:OrbyConversationStatus;
 channel:'web'|'mobile';
 kernelSessionId?:string;
 createdAt:string;
 updatedAt:string;
 lastMessageAt:string;
 metadata:OrbyJsonObject;
};

export type OrbyStreamStage='accepted'|'context'|'routing'|'responding'|'saving'|'completed';
export type OrbyConversationStreamEvent=
 |{type:'status';stage:OrbyStreamStage;label:string}
 |{type:'start';requestId:string;sessionId:string;providerId:string;modelId:string}
 |{type:'delta';text:string}
 |{type:'usage';usage:OrbyUsage}
 |{type:'citations';items:readonly Extract<OrbyConversationPart,{type:'citation'}>[]}
 |{type:'dialogue';decision:Pick<OrbyDialogueDecision,'strategy'|'requiresClarification'|'clarificationQuestion'|'promptVersion'> & {intent:string;operation:string;sector:string;sensitivity:string;confidence:number}}
 |{type:'complete';conversationId:string;remaining:number;source:'ai'|'smart-fallback';requestId?:string;sessionId?:string}
 |{type:'error';code:string;message:string;retryable:boolean};

export const ORBY_CONVERSATION_PROTOCOL_VERSION='2.0.0';
