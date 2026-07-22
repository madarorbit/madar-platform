import {currentProfile} from '@/src/lib/supabase/server';
import NavbarClient from './NavbarClient';

export default async function Navbar(){
 const profile=await currentProfile().catch(()=>null);
 return <NavbarClient authenticated={Boolean(profile)} displayName={profile?.full_name||undefined} hasAvatar={Boolean(profile?.avatar_url)} isAdmin={profile?.role==='ADMIN'||profile?.role==='SUPER_ADMIN'}/>;
}
