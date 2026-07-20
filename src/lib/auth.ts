import { redirect } from 'next/navigation'; import { currentProfile, currentUser, type Profile } from '@/src/lib/supabase/server';
export function safeReturnTo(value:string|null|undefined, fallback='/account'){return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;}
export async function requireUser(){const user=await currentUser(); if(!user) redirect('/login'); return user;}
export async function requireAdmin():Promise<Profile>{const profile=await currentProfile(); if(!profile) redirect('/login?next=/admin'); if(profile.status!=='active'||!['ADMIN','SUPER_ADMIN'].includes(profile.role)) redirect('/account?error=forbidden'); return profile;}
export async function requireSuperAdmin():Promise<Profile>{const profile=await requireAdmin(); if(profile.role!=='SUPER_ADMIN') redirect('/admin?error=forbidden'); return profile;}
