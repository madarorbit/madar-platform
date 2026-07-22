export const organizationTypes = ['INDIVIDUAL','MERCHANT','COMPANY','STUDENT'] as const;
export type OrganizationType = typeof organizationTypes[number];
export type OrganizationRole = 'OWNER'|'ADMIN'|'MEMBER';
export const organizationTypeLabels: Record<OrganizationType,string>={INDIVIDUAL:'فردي',MERCHANT:'متجر / تجارة',COMPANY:'شركة / مؤسسة',STUDENT:'طالب'};
export function workspaceSlug(value:string){return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);}
export function canManageWorkspace(role:OrganizationRole){return role==='OWNER'||role==='ADMIN';}
export function canManageMembers(role:OrganizationRole){return role==='OWNER';}
