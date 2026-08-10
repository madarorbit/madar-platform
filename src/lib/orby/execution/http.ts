import {NextResponse} from 'next/server';
import {currentUser,type AuthUser} from '@/src/lib/supabase/server';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import {OrbyExecutionError,normalizeExecutionError} from './errors';

export function agentIdentity(user:AuthUser,input:{organizationId?:unknown;workspaceId?:unknown}):OrbyIdentity{const organizationId=String(input.organizationId||'').trim(),workspaceId=String(input.workspaceId||'').trim();if(!organizationId)throw new OrbyExecutionError('معرّف مساحة العمل مطلوب.','PLAN_INVALID');return{organizationId,userId:user.id,workspaceId:workspaceId||organizationId};}
export async function authenticateAgentRequest(request:Request){const header=request.headers.get('authorization')||'',parts=header.split(/\s+/,2),accessToken=parts[0]?.toLowerCase()==='bearer'&&parts[1]?parts[1]:undefined;return currentUser(accessToken);}
export function agentMetadata(value:unknown):OrbyJsonObject|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as OrbyJsonObject:undefined;}
export function agentErrorResponse(error:unknown){const normalized=normalizeExecutionError(error),status=normalized.code==='PERMISSION_DENIED'||normalized.code==='TOOL_UNAUTHORIZED'?403:normalized.code==='LIMIT_EXCEEDED'?429:['PLAN_INVALID','TOOL_INVALID','APPROVAL_REQUIRED','APPROVAL_REJECTED','APPROVAL_EXPIRED'].includes(normalized.code)?400:['EXECUTION_DISABLED','PLANNING_DISABLED','TOOL_DISABLED'].includes(normalized.code)?503:normalized.code==='RUN_NOT_FOUND'||normalized.code==='WORKFLOW_NOT_FOUND'?404:500;return NextResponse.json({ok:false,error:{code:normalized.code,message:normalized.message}},{status,headers:{'Cache-Control':'no-store'}});}
