import type {OrbyIdentity} from '../../core/contracts';
import type {OrbyMembership,OrbyMembershipResolver} from '../contracts';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {params} from './supabase-shared';

export class SupabaseOrbyMembershipResolver implements OrbyMembershipResolver {
 constructor(private readonly database=new IntegrationDatabase()){}
 async resolve(identity:OrbyIdentity){
  type Row={role:'OWNER'|'ADMIN'|'MEMBER';organizations:{status:string}|{status:string}[]|null};const row=(await this.database.select<Row>('organization_members',params({select:'role,organizations(status)',organization_id:`eq.${identity.organizationId}`,user_id:`eq.${identity.userId}`,limit:'1'})))[0];if(!row)return null;const organization=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;if(!organization)return null;return{organizationId:identity.organizationId,userId:identity.userId,role:row.role,organizationStatus:organization.status,workspaceAuthorized:!identity.workspaceId||identity.workspaceId===identity.organizationId,permissions:[]} satisfies OrbyMembership;
 }
}
