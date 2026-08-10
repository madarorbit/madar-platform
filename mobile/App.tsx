import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppState,I18nManager,SafeAreaView,StatusBar,StyleSheet,Text,View,useColorScheme} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {BottomNav,Button,LoadingView,WorkspaceSwitcher} from '@/components/ui';
import {MadarApiError,fetchDashboard} from '@/lib/api';
import {readDashboardCache,readSelectedWorkspace,readThemePreference,type ThemePreference,writeDashboardCache,writeSelectedWorkspace,writeThemePreference} from '@/lib/cache';
import {supabase} from '@/lib/supabase';
import {darkTheme,lightTheme,type MadarTheme} from '@/theme';
import type {DashboardSnapshot,Tab} from '@/types';
import {AccountScreen} from '@/screens/account-screen';
import {HomeScreen} from '@/screens/home-screen';
import {LoginScreen} from '@/screens/login-screen';
import {OperationsScreen} from '@/screens/operations-screen';
import {OrbyScreen} from '@/screens/orby-screen';
import {ReportsScreen} from '@/screens/reports-screen';

I18nManager.allowRTL(true);

export default function App(){
 const[session,setSession]=useState<Session|null>(null),[authReady,setAuthReady]=useState(false),[themePreference,setThemePreference]=useState<ThemePreference>('system');
 const systemScheme=useColorScheme(),theme=useMemo(()=>themePreference==='dark'?darkTheme:themePreference==='light'?lightTheme:systemScheme==='light'?lightTheme:darkTheme,[systemScheme,themePreference]);
 useEffect(()=>{readThemePreference().then(setThemePreference);supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthReady(true);});const{data}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);setAuthReady(true);});return()=>data.subscription.unsubscribe();},[]);
 async function changeTheme(value:ThemePreference){setThemePreference(value);await writeThemePreference(value);}
 return <SafeAreaView style={[styles.safe,{backgroundColor:theme.colors.background}]}><StatusBar barStyle={theme.dark?'light-content':'dark-content'} backgroundColor={theme.colors.background}/>{!authReady?<LoadingView theme={theme} label="جارٍ استعادة جلسة مَدار…"/>:!session?<LoginScreen theme={theme}/>:<AuthenticatedApp key={session.user.id} session={session} theme={theme} themePreference={themePreference} onThemeChange={changeTheme}/>}</SafeAreaView>;
}

function AuthenticatedApp({session,theme,themePreference,onThemeChange}:{session:Session;theme:MadarTheme;themePreference:ThemePreference;onThemeChange:(value:ThemePreference)=>void}){
 const[tab,setTab]=useState<Tab>('home'),[snapshot,setSnapshot]=useState<DashboardSnapshot|null>(null),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState<string|null>(null),[offline,setOffline]=useState(false),[switcher,setSwitcher]=useState(false);
 const snapshotRef=useRef<DashboardSnapshot|null>(null),requestSequence=useRef(0);
 const load=useCallback(async(workspaceId?:string|null,options:{manual?:boolean;silent?:boolean}={})=>{
  const sequence=++requestSequence.current,target=workspaceId||snapshotRef.current?.workspace.id||await readSelectedWorkspace(session.user.id);
  if(options.manual)setRefreshing(true);else if(!options.silent&&!snapshotRef.current)setLoading(true);setError(null);
  try{const fresh=await fetchDashboard(session.access_token,target);await writeDashboardCache(fresh);if(sequence===requestSequence.current){setSnapshot(fresh);snapshotRef.current=fresh;setOffline(false);}return fresh;}
  catch(cause){if(sequence!==requestSequence.current)return null;const message=cause instanceof Error?cause.message:'تعذر تحميل لوحة القيادة.',cached=await readDashboardCache(session.user.id,target);if(cached){setSnapshot(cached);snapshotRef.current=cached;setOffline(true);setError('تعذر التحديث الآن، وتُعرض آخر نسخة محفوظة على الجهاز.');}else setError(message);if(cause instanceof MadarApiError&&cause.status===401)await supabase.auth.signOut();return null;}
  finally{if(sequence===requestSequence.current){setLoading(false);setRefreshing(false);}}
 },[session.access_token,session.user.id]);
 useEffect(()=>{snapshotRef.current=snapshot;},[snapshot]);

 useEffect(()=>{let active=true;(async()=>{const selected=await readSelectedWorkspace(session.user.id),cached=await readDashboardCache(session.user.id,selected);if(active&&cached){setSnapshot(cached);snapshotRef.current=cached;setLoading(false);}if(active)await load(selected);})();return()=>{active=false;};},[load,session.user.id]);
 useEffect(()=>{if(!snapshot?.workspace.id)return;const organizationId=snapshot.workspace.id,refresh=()=>load(organizationId,{silent:true});const channel=supabase.channel(`dashboard-v2:${organizationId}`).on('postgres_changes',{event:'*',schema:'public',table:'business_tasks',filter:`organization_id=eq.${organizationId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'orby_insights',filter:`organization_id=eq.${organizationId}`},refresh).on('postgres_changes',{event:'*',schema:'public',table:'mobile_action_commands',filter:`organization_id=eq.${organizationId}`},refresh).subscribe();const appState=AppState.addEventListener('change',state=>{if(state==='active')refresh();}),timer=setInterval(refresh,60_000);return()=>{appState.remove();clearInterval(timer);supabase.removeChannel(channel);};},[load,snapshot?.workspace.id]);

 async function switchWorkspace(workspaceId:string){setSwitcher(false);if(workspaceId===snapshotRef.current?.workspace.id)return;setLoading(true);await writeSelectedWorkspace(session.user.id,workspaceId);await load(workspaceId);setTab('home');}
 if(loading&&!snapshot)return <LoadingView theme={theme} label="جارٍ تجهيز مركز القيادة…"/>;
 if(!snapshot)return <View style={styles.failure}><Text style={[styles.failureTitle,{color:theme.colors.text}]}>لم نتمكن من فتح مساحة العمل</Text><Text style={[styles.failureBody,{color:theme.colors.muted}]}>{error||'تحقق من الاتصال ثم أعد المحاولة.'}</Text><Button theme={theme} label="إعادة المحاولة" onPress={()=>load()}/><Button theme={theme} kind="ghost" label="تسجيل الخروج" onPress={()=>supabase.auth.signOut()}/></View>;
 const refresh=()=>load(snapshot.workspace.id,{manual:true}),changed=async()=>{await load(snapshot.workspace.id,{silent:true});};
 return <View style={styles.app}>
  <View style={styles.screen}>
   {tab==='home'?<HomeScreen theme={theme} snapshot={snapshot} refreshing={refreshing} offline={offline} error={error} onRefresh={refresh} onNavigate={setTab} onOpenWorkspaces={()=>setSwitcher(true)}/>:null}
   {tab==='reports'?<ReportsScreen theme={theme} snapshot={snapshot} refreshing={refreshing} onRefresh={refresh}/>:null}
   {tab==='operations'?<OperationsScreen key={snapshot.workspace.id} theme={theme} snapshot={snapshot} accessToken={session.access_token} refreshing={refreshing} onRefresh={refresh} onChanged={changed} onAskOrby={()=>setTab('orby')}/>:null}
   {tab==='orby'?<OrbyScreen key={snapshot.workspace.id} theme={theme} snapshot={snapshot} accessToken={session.access_token} onOpenOperations={()=>setTab('operations')}/>:null}
   {tab==='account'?<AccountScreen theme={theme} snapshot={snapshot} themePreference={themePreference} onThemeChange={onThemeChange} onOpenWorkspaces={()=>setSwitcher(true)}/>:null}
  </View>
  <BottomNav theme={theme} active={tab} onChange={setTab} attention={snapshot.status==='attention'||snapshot.recentActions.some(item=>['CONFLICT','FAILED'].includes(item.effective_status))}/>
  <WorkspaceSwitcher theme={theme} visible={switcher} workspaces={snapshot.availableWorkspaces} activeId={snapshot.workspace.id} onClose={()=>setSwitcher(false)} onSelect={switchWorkspace}/>
 </View>;
}

const styles=StyleSheet.create({safe:{flex:1},app:{flex:1},screen:{flex:1},failure:{flex:1,padding:28,alignItems:'stretch',justifyContent:'center',gap:13},failureTitle:{fontSize:23,fontWeight:'900',textAlign:'center'},failureBody:{fontSize:13,lineHeight:21,textAlign:'center',marginBottom:8}});
