import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {requireWorkspace} from '@/src/lib/retail/server/auth/context';

export const metadata:Metadata={title:'ORBY | MADAR Retail'};
export const dynamic='force-dynamic';

export default async function RetailOrbyPage(){
 const{user}=await requireWorkspace();
 redirect(`/orby?conversation=new&organization=${encodeURIComponent(user.platformOrganizationId)}`);
}
