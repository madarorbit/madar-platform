import {Linking,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Badge,BrandMark,Button,Card,ScreenHeader,SectionTitle} from '@/components/ui';
import {clearDashboardCache,type ThemePreference} from '@/lib/cache';
import {dateTime,freshness,planLabel,sourceLabel} from '@/lib/format';
import {supabase} from '@/lib/supabase';
import type {MadarTheme} from '@/theme';
import type {DashboardSnapshot} from '@/types';

type Props={theme:MadarTheme;snapshot:DashboardSnapshot;themePreference:ThemePreference;onThemeChange:(value:ThemePreference)=>void;onOpenWorkspaces:()=>void};
const preferenceLabel=(value:ThemePreference)=>value==='system'?'حسب الجهاز':value==='dark'?'داكن':'فاتح';

export function AccountScreen({theme,snapshot,themePreference,onThemeChange,onOpenWorkspaces}:Props){
 const next:ThemePreference=themePreference==='system'?'dark':themePreference==='dark'?'light':'system';
 async function signOut(){await clearDashboardCache();await supabase.auth.signOut();}
 return <ScrollView style={{backgroundColor:theme.colors.background}} contentContainerStyle={styles.content}>
  <ScreenHeader theme={theme} eyebrow="الحساب والصلاحيات" title="مركزك الشخصي" description="الهوية النشطة، مساحة العمل، الباقة والاتصال في مكان واحد."/>
  <Card theme={theme} accent={theme.colors.mint}>
   <View style={styles.profile}><BrandMark theme={theme}/><View style={styles.profileText}><Text style={[styles.name,{color:theme.colors.text}]}>{snapshot.profile.fullName||'مستخدم مَدار'}</Text><Text style={[styles.email,{color:theme.colors.muted}]}>{snapshot.profile.email||'—'}</Text></View><Badge theme={theme} label={snapshot.workspace.role} tone="mint"/></View>
  </Card>

  <SectionTitle theme={theme} title="مساحة العمل"/>
  <Card theme={theme}>
   <InfoLine theme={theme} label="المساحة" value={snapshot.workspace.name}/><InfoLine theme={theme} label="النشاط" value={snapshot.vertical.name}/><InfoLine theme={theme} label="نمط التشغيل" value={snapshot.workspace.operatingMode==='MADAR_NATIVE'?'مَدار هو النظام الأساسي':'ربط نظام قائم'}/><InfoLine theme={theme} label="مصدر الحقيقة" value={sourceLabel(snapshot.workspace.sourceOfTruth)}/><View style={{marginTop:13}}><Button theme={theme} kind="secondary" label={snapshot.availableWorkspaces.length>1?'تبديل مساحة العمل':'مساحة العمل الحالية'} onPress={onOpenWorkspaces} disabled={snapshot.availableWorkspaces.length<2}/></View>
  </Card>

  <SectionTitle theme={theme} title="الباقة والاستحقاقات"/>
  <Card theme={theme}>
   <View style={styles.planTop}><View><Text style={[styles.plan,{color:theme.colors.text}]}>الاشتراك {planLabel(snapshot.subscription.level)}</Text><Text style={[styles.planTerm,{color:theme.colors.muted}]}>{snapshot.subscription.termMonths} شهر • {snapshot.subscriptionStatus==='trialing'?'تجربة الإطلاق':'اشتراك نشط'}</Text></View><Badge theme={theme} label={snapshot.subscriptionStatus==='trialing'?'تجريبي':'نشط'} tone={snapshot.subscriptionStatus==='past_due'?'amber':'mint'}/></View>
   <InfoLine theme={theme} label="نهاية التجربة" value={dateTime(snapshot.subscription.trialEndsAt)}/><InfoLine theme={theme} label="نهاية الدورة" value={dateTime(snapshot.subscription.endsAt)}/><InfoLine theme={theme} label="أوربي" value={snapshot.permissions.canUseOrby?'متاح':'غير متاح'}/><InfoLine theme={theme} label="أدوات الكتابة" value={snapshot.permissions.canUseWriteTools?'مع معاينة وتأكيد':'غير متاحة'}/>
   <View style={{marginTop:13}}><Button theme={theme} kind="secondary" label="إدارة الاشتراك على المنصة" onPress={()=>Linking.openURL('https://www.orbitmadar.com/dashboard/billing')}/></View>
  </Card>

  <SectionTitle theme={theme} title="الاتصال والمزامنة"/>
  <Card theme={theme}>
   <InfoLine theme={theme} label="آخر مزامنة ناجحة" value={freshness(snapshot.synchronization.lastSuccessfulAt||snapshot.fetchedAt)}/><InfoLine theme={theme} label="الموصلات" value={snapshot.synchronization.connections.length.toLocaleString('ar-SA')}/><InfoLine theme={theme} label="صلاحيات الكتابة" value={snapshot.synchronization.writeGrants.length.toLocaleString('ar-SA')}/>
   {snapshot.synchronization.connections.map(connection=><View key={connection.id} style={[styles.connection,{borderTopColor:theme.colors.border}]}><View style={[styles.connectionDot,{backgroundColor:connection.status==='active'?theme.colors.mint:theme.colors.amber}]}/><View style={styles.connectionText}><Text style={[styles.connectionName,{color:theme.colors.text}]}>{connection.name}</Text><Text style={[styles.connectionMeta,{color:theme.colors.muted}]}>{connection.connection_mode} • {connection.last_success_at?freshness(connection.last_success_at):'بانتظار أول مزامنة'}</Text></View></View>)}
  </Card>

  <SectionTitle theme={theme} title="المظهر والتطبيق"/>
  <Pressable accessibilityRole="button" onPress={()=>onThemeChange(next)} style={({pressed})=>[styles.setting,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><View style={[styles.settingIcon,{backgroundColor:theme.colors.violetSoft}]}><Text style={{color:theme.colors.violet}}>{theme.dark?'◐':'☼'}</Text></View><View style={styles.settingText}><Text style={[styles.settingTitle,{color:theme.colors.text}]}>مظهر التطبيق</Text><Text style={[styles.settingValue,{color:theme.colors.muted}]}>{preferenceLabel(themePreference)} • اضغط للتبديل</Text></View></Pressable>
  <Pressable accessibilityRole="link" onPress={()=>Linking.openURL('https://www.orbitmadar.com/privacy')} style={({pressed})=>[styles.setting,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><View style={[styles.settingIcon,{backgroundColor:theme.colors.skySoft}]}><Text style={{color:theme.colors.sky}}>⌁</Text></View><View style={styles.settingText}><Text style={[styles.settingTitle,{color:theme.colors.text}]}>الخصوصية والأمان</Text><Text style={[styles.settingValue,{color:theme.colors.muted}]}>سياسة البيانات والصلاحيات</Text></View></Pressable>
  <Button theme={theme} kind="danger" label="تسجيل الخروج" onPress={signOut}/>
  <Text style={[styles.version,{color:theme.colors.faint}]}>MADAR Dashboard V2.0 • نفس نواة مَدار وORBY OS</Text>
 </ScrollView>;
}

function InfoLine({theme,label,value}:{theme:MadarTheme;label:string;value:string}){return <View style={[styles.info,{borderBottomColor:theme.colors.border}]}><Text style={[styles.infoLabel,{color:theme.colors.muted}]}>{label}</Text><Text style={[styles.infoValue,{color:theme.colors.text}]}>{value}</Text></View>;}
const styles=StyleSheet.create({content:{padding:20,paddingBottom:38,gap:13},profile:{flexDirection:'row',alignItems:'center',gap:12},profileText:{flex:1,alignItems:'flex-start'},name:{fontSize:17,fontWeight:'900',textAlign:'right'},email:{fontSize:11,marginTop:4},info:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,borderBottomWidth:1},infoLabel:{fontSize:11},infoValue:{fontSize:12,fontWeight:'800',textAlign:'left',maxWidth:'62%'},planTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},plan:{fontSize:18,fontWeight:'900',textAlign:'right'},planTerm:{fontSize:11,marginTop:4},connection:{flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:1,paddingTop:12,marginTop:12},connectionDot:{width:9,height:9,borderRadius:5},connectionText:{flex:1,alignItems:'flex-start'},connectionName:{fontSize:12,fontWeight:'800'},connectionMeta:{fontSize:10,marginTop:3},setting:{borderWidth:1,borderRadius:19,padding:14,flexDirection:'row',alignItems:'center',gap:11},settingIcon:{width:38,height:38,borderRadius:14,alignItems:'center',justifyContent:'center'},settingText:{flex:1,alignItems:'flex-start'},settingTitle:{fontSize:13,fontWeight:'800'},settingValue:{fontSize:10,marginTop:4},version:{fontSize:10,textAlign:'center',marginTop:3}});
