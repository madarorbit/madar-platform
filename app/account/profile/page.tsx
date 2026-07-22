import { currentProfile } from '@/src/lib/supabase/server';
import { requireUser } from '@/src/lib/auth';
import ProfileForm from './form';

export const dynamic='force-dynamic';
export default async function Page(){
 await requireUser();
 const profile=await currentProfile();
 return <main className="mx-auto max-w-xl p-8"><ProfileForm fullName={profile?.full_name||''} phone={profile?.phone||''} hasAvatar={Boolean(profile?.avatar_url)}/></main>;
}
