import type {Metadata} from 'next';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';
import OrbyShell from '@/components/orby/OrbyShell';
import OrbyChat from '@/components/orby/OrbyChat';
import OrbyConversationSidebar from '@/components/orby/OrbyConversationSidebar';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'ORBY | مَدار',description:'تحدث مع ORBY، المساعد الذكي لمنصة مَدار.'};

type Conversation={id:string;title:string;last_message_at:string;organization_id:string|null;service_code:string|null};
type Message={id:string;role:'user'|'assistant';content:string;source?:string};
type Usage={tier:'registered'|'customer'|'plus';daily_limit:number;used:number;remaining:number};
type Subscription={organization_id:string;service_code:string;organizations?:{name?:string;status?:string}|Array<{name?:string;status?:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nested=<T,>(value:T|T[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function OrbyPage({searchParams}:{searchParams:Promise<{conversation?:string;organization?:string;starter?:string}>}){
 const params=await searchParams,user=await currentUser();
 if(!user){const guestKey=`guest:${params.starter||'chat'}`;return <OrbyShell authenticated={false} plus={false} newChatHref="/orby" sidebar={undefined} contextLabel="محادثة عامة" returnHref="/"><OrbyChat key={guestKey} authenticated={false} organizationId={null} serviceCode={null} initialConversationId={null} initialMessages={[]} initialRemaining={5} initialLimit={5} tier="guest" starter={params.starter}/></OrbyShell>;}
 const[conversationRows,subscriptionRows,usageRaw]=await Promise.all([
  supabaseFetch(`/rest/v1/orby_conversations?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=id,title,last_message_at,organization_id,service_code&order=last_message_at.desc&limit=100`).catch(()=>[]),
  supabaseFetch(`/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&activation_state=eq.ACTIVE&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=organization_id,service_code,organizations(name,status)&order=created_at.desc`).catch(()=>[]),
  supabaseFetch('/rest/v1/rpc/orby_usage_status',{method:'POST',body:'{}'}).catch(()=>({tier:'registered',daily_limit:5,used:0,remaining:5})),
 ]);
 const conversations=(conversationRows||[]) as Conversation[],subscriptions=(subscriptionRows||[]) as Subscription[],usage=(Array.isArray(usageRaw)?usageRaw[0]:usageRaw) as Usage;
 const scopes=subscriptions.map(item=>({organizationId:item.organization_id,serviceCode:item.service_code,name:nested(item.organizations)?.name||'مساحة مَدار'})).filter((item,index,array)=>array.findIndex(other=>other.organizationId===item.organizationId)===index);
 const requestedConversation=params.conversation&&uuid.test(params.conversation)?params.conversation:null,selected=conversations.find(item=>item.id===requestedConversation)||null;
 const requestedOrganization=params.organization&&uuid.test(params.organization)?params.organization:null,scopeFromQuery=scopes.find(item=>item.organizationId===requestedOrganization)||null;
 const selectedOrganizationId=selected?.organization_id||scopeFromQuery?.organizationId||null,selectedServiceCode=selected?.service_code||scopeFromQuery?.serviceCode||null;
 let messages:Message[]=[];
 if(selected){messages=(await supabaseFetch(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(selected.id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,role,content,source&role=in.(user,assistant)&order=created_at.asc,id.asc`).catch(()=>[])) as Message[];}
 const newChatHref=selectedOrganizationId?`/orby?conversation=new&organization=${encodeURIComponent(selectedOrganizationId)}`:'/orby?conversation=new';
 const activeScope=scopes.find(item=>item.organizationId===selectedOrganizationId),contextLabel=activeScope?`${activeScope.name} · ${selectedServiceCode==='MADAR_RETAIL'?'MADAR Retail':selectedServiceCode==='CONNECT_EXISTING'?'تجارة مرتبطة':'تجارة مَدار'}`:'محادثة عامة';
 const returnHref=selectedServiceCode==='MADAR_RETAIL'?'/retail/workspace':selectedServiceCode==="CONNECT_EXISTING"||selectedServiceCode==="BUILD_ON_MADAR"?'/workspace':'/account';
 const sidebar=<OrbyConversationSidebar conversations={conversations} selectedId={selected?.id||null} scopes={scopes} selectedOrganizationId={selectedOrganizationId} tier={usage.tier}/>;
 const chatKey=[selected?.id||'new',selectedOrganizationId||'general',params.starter||'chat'].join(':');
 return <OrbyShell authenticated plus={usage.tier==='plus'} newChatHref={newChatHref} sidebar={sidebar} contextLabel={contextLabel} returnHref={returnHref}><OrbyChat key={chatKey} authenticated organizationId={selectedOrganizationId} serviceCode={selectedServiceCode} initialConversationId={selected?.id||null} initialMessages={messages} initialRemaining={Number(usage.remaining??5)} initialLimit={Number(usage.daily_limit??5)} tier={usage.tier||'registered'} starter={params.starter}/></OrbyShell>;
}
