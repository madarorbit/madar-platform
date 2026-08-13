import {redirect} from 'next/navigation';
import {requireBusinessWorkspace} from '@/src/lib/business';

export const dynamic='force-dynamic';
export const metadata={title:'ORBY | مَدار'};

export default async function WorkspaceOrbyPage(){
 const{workspace}=await requireBusinessWorkspace();
 const service=workspace.operating_mode==='CONNECTED_EXTERNAL'?'CONNECT_EXISTING':'BUILD_ON_MADAR';
 redirect(`/orby?conversation=new&organization=${encodeURIComponent(workspace.id)}&service=${service}`);
}
