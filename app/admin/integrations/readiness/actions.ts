'use server';

import {revalidatePath} from 'next/cache';
import {requireSuperAdmin} from '@/src/lib/auth';
import {IntegrationDatabase,SecretsManager} from '@/src/lib/integration/platform';
import {IntegrationReadinessLab} from '@/src/lib/integration/lab/readiness-runner';

export async function runIntegrationReadinessLab(formData:FormData){
 const profile=await requireSuperAdmin(),raw=formData.get('organization_id'),organizationId=typeof raw==='string'&&/^[0-9a-f-]{36}$/i.test(raw)?raw:null;
 const lab=new IntegrationReadinessLab(new IntegrationDatabase(),new SecretsManager());
 await lab.run({organizationId,actorId:profile.id});
 revalidatePath('/admin/integrations/readiness');
 revalidatePath('/admin/integrations/audit');
}
