import {currentUser,profileForUser,type AuthUser} from '@/src/lib/supabase/server';
import NavbarClient from './NavbarClient';

function fallbackDisplayName(user:AuthUser|null){
 const metadataName=user?.user_metadata?.full_name;
 if(typeof metadataName==='string'&&metadataName.trim())return metadataName.trim();
 return user?.email?.split('@')[0]||undefined;
}

export default async function Navbar(){
 const user=await currentUser().catch(()=>null);
 const profile=user?await profileForUser(user.id).catch(()=>null):null;
 return <NavbarClient authenticated={Boolean(user)} displayName={profile?.full_name||fallbackDisplayName(user)} hasAvatar={Boolean(profile?.avatar_url)} isAdmin={profile?.role==='ADMIN'||profile?.role==='SUPER_ADMIN'}/>;
}
