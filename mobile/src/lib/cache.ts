import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DashboardSnapshot} from '@/types';

const prefix='madar-dashboard-v2';
const themeKey=`${prefix}:theme`;
const selectedWorkspaceKey=(userId:string)=>`${prefix}:user:${userId}:selected-workspace`;
const cacheKey=(userId:string,workspaceId:string)=>`${prefix}:user:${userId}:snapshot:${workspaceId}`;

export type ThemePreference='system'|'dark'|'light';

function parseSnapshot(raw:string|null){
 if(!raw)return null;
 try{return JSON.parse(raw) as DashboardSnapshot;}catch{return null;}
}

export async function readSelectedWorkspace(userId:string){try{return await AsyncStorage.getItem(selectedWorkspaceKey(userId));}catch{return null;}}
export async function writeSelectedWorkspace(userId:string,workspaceId:string){try{await AsyncStorage.setItem(selectedWorkspaceKey(userId),workspaceId);}catch{/* The server remains the source of truth if local storage is unavailable. */}}

export async function readDashboardCache(userId:string,workspaceId?:string|null){
 try{
  const selected=workspaceId||await readSelectedWorkspace(userId);
  if(!selected)return null;
  const key=cacheKey(userId,selected),raw=await AsyncStorage.getItem(key),snapshot=parseSnapshot(raw);
  if(!snapshot&&raw){await AsyncStorage.removeItem(key);return null;}
  const expired=snapshot&&(!Number.isFinite(Date.parse(snapshot.fetchedAt))||Date.now()-Date.parse(snapshot.fetchedAt)>86_400_000);
  if(snapshot&&(snapshot.profile.id!==userId||expired)){await AsyncStorage.removeItem(key);return null;}
  return snapshot;
 }catch{return null;}
}

export async function writeDashboardCache(snapshot:DashboardSnapshot){
 try{await AsyncStorage.multiSet([[cacheKey(snapshot.profile.id,snapshot.workspace.id),JSON.stringify(snapshot)],[selectedWorkspaceKey(snapshot.profile.id),snapshot.workspace.id]]);}catch{/* Offline cache is best-effort and never affects a successful network response. */}
}

export async function clearDashboardCache(){
 try{const keys=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith(`${prefix}:user:`));if(keys.length)await AsyncStorage.multiRemove(keys);}catch{/* Sign-out still revokes the Supabase session. */}
}

export async function readThemePreference(){
 try{const value=await AsyncStorage.getItem(themeKey);return value==='dark'||value==='light'?value:'system' as ThemePreference;}catch{return 'system';}
}
export async function writeThemePreference(value:ThemePreference){try{await AsyncStorage.setItem(themeKey,value);}catch{/* Keep the in-memory preference for this session. */}}
