import { redirect } from 'next/navigation'; import { currentUserState, profileForUser, type Profile } from '@/src/lib/supabase/server';
export function safeReturnTo(value:string|null|undefined, fallback='/account'){return value?.startsWith('/') && !value.startsWith('//') ? value : fallback;}
const recoveryHref=(nextPath:string)=>`/auth/recover?next=${encodeURIComponent(safeReturnTo(nextPath,'/account'))}`;
const loginHref=(nextPath:string)=>`/login?next=${encodeURIComponent(safeReturnTo(nextPath,'/account'))}`;
export async function requireUser(nextPath='/account'){const state=await currentUserState();if(state.status==='recovering')redirect(recoveryHref(nextPath));if(state.status==='unauthenticated')redirect(loginHref(nextPath));return state.user;}
export async function requireAdmin():Promise<Profile>{const user=await requireUser('/admin');const profile=await profileForUser(user.id);if(!profile)redirect('/login?next=/admin');if(profile.status!=='active'||!['ADMIN','SUPER_ADMIN'].includes(profile.role))redirect('/account?error=forbidden');return profile;}
export async function requireSuperAdmin():Promise<Profile>{const profile=await requireAdmin(); if(profile.role!=='SUPER_ADMIN') redirect('/admin?error=forbidden'); return profile;}
