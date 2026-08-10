import {Pressable,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Badge,Card,ErrorBanner,ScreenHeader,SectionTitle} from '@/components/ui';
import {freshness,money,sourceLabel,verticalLabel} from '@/lib/format';
import type {MadarTheme} from '@/theme';
import type {DashboardAlert,DashboardSnapshot,Tab} from '@/types';

type Props={theme:MadarTheme;snapshot:DashboardSnapshot;refreshing:boolean;offline:boolean;error:string|null;onRefresh:()=>void;onNavigate:(tab:Tab)=>void;onOpenWorkspaces:()=>void};
const numeric=(value:unknown)=>typeof value==='number'?value:Number(value||0);

function sectorMetrics(snapshot:DashboardSnapshot){
 const sector=snapshot.summary.sector,currency=snapshot.workspace.currency;
 if(snapshot.vertical.extension==='food_service')return[
  {label:'إيراد المطعم',value:money(numeric(sector.revenue),currency),tone:'mint' as const},
  {label:'تكلفة المكونات',value:money(numeric(sector.ingredient_cost),currency),tone:'amber' as const},
  {label:'الربح الإجمالي',value:money(numeric(sector.gross_profit),currency),tone:'violet' as const},
 ];
 if(snapshot.vertical.extension==='hospitality')return[
  {label:'الإشغال',value:`${numeric(sector.occupancy_rate).toFixed(1)}%`,tone:'mint' as const},
  {label:'متوسط سعر الغرفة',value:money(numeric(sector.adr),currency),tone:'sky' as const},
  {label:'RevPAR',value:money(numeric(sector.revpar),currency),tone:'violet' as const},
 ];
 return[
  {label:'إيراد 30 يومًا',value:money(snapshot.summary.revenue30d,currency),tone:'mint' as const},
  {label:'المصروفات',value:money(snapshot.summary.expenses30d,currency),tone:'amber' as const},
  {label:'صافي النتيجة',value:money(snapshot.summary.profit30d,currency),tone:'violet' as const},
 ];
}

const toneForAlert=(alert:DashboardAlert)=>alert.severity==='critical'?'red':alert.severity==='warning'?'amber':alert.severity==='success'?'mint':'sky' as const;

export function HomeScreen({theme,snapshot,refreshing,offline,error,onRefresh,onNavigate,onOpenWorkspaces}:Props){
 const metrics=sectorMetrics(snapshot),name=snapshot.profile.fullName?.trim().split(/\s+/)[0]||'مرحبًا';
 return <ScrollView style={{backgroundColor:theme.colors.background}} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.mint} colors={[theme.colors.mint]}/>}>
  <ScreenHeader theme={theme} eyebrow={`${verticalLabel(snapshot.vertical.extension)} • ${snapshot.vertical.name}`} title={`أهلًا ${name}`} description="هذه صورة حيّة لما يحتاج انتباهك الآن." action={<Pressable accessibilityRole="button" accessibilityLabel="تبديل مساحة العمل" onPress={onOpenWorkspaces} style={({pressed})=>[styles.workspaceButton,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><Text numberOfLines={1} style={[styles.workspaceName,{color:theme.colors.text}]}>{snapshot.workspace.name}</Text><Text style={{color:theme.colors.mint}}>⌄</Text></Pressable>}/>
  {error?<ErrorBanner theme={theme} message={error} offline={offline}/>:null}
  <Card theme={theme} accent={snapshot.status==='attention'?theme.colors.amber:theme.colors.mint}>
   <View style={styles.statusTop}><View style={styles.statusText}><Text style={[styles.statusTitle,{color:theme.colors.text}]}>{snapshot.status==='attention'?'هناك ما يستحق الانتباه':'العمل يسير بصورة مستقرة'}</Text><Text style={[styles.statusBody,{color:theme.colors.muted}]}>المصدر: {sourceLabel(snapshot.synchronization.sourceOfTruth)} • آخر تحديث {freshness(snapshot.fetchedAt)}</Text></View><Badge theme={theme} label={offline?'نسخة محفوظة':snapshot.status==='attention'?'تحتاج مراجعة':'متصل'} tone={offline?'amber':snapshot.status==='attention'?'amber':'mint'}/></View>
   <View style={[styles.syncLine,{borderTopColor:theme.colors.border}]}><Text style={[styles.syncLabel,{color:theme.colors.muted}]}>آخر مزامنة للمصدر</Text><Text style={[styles.syncValue,{color:theme.colors.text}]}>{freshness(snapshot.synchronization.lastSuccessfulAt||snapshot.fetchedAt)}</Text></View>
  </Card>

  <SectionTitle theme={theme} title="المؤشرات الأهم" caption="مؤشرات مخصصة لنوع نشاطك"/>
  <View style={styles.metricGrid}>{metrics.map((item,index)=><Card key={item.label} theme={theme} style={styles.metricCard}><View style={[styles.metricOrb,{backgroundColor:item.tone==='mint'?theme.colors.mintSoft:item.tone==='amber'?theme.colors.amberSoft:item.tone==='sky'?theme.colors.skySoft:theme.colors.violetSoft}]}><Text style={{color:item.tone==='mint'?theme.colors.mint:item.tone==='amber'?theme.colors.amber:item.tone==='sky'?theme.colors.sky:theme.colors.violet}}>{index===0?'↗':index===1?'◫':'◇'}</Text></View><Text style={[styles.metricValue,{color:theme.colors.text}]}>{item.value}</Text><Text style={[styles.metricLabel,{color:theme.colors.muted}]}>{item.label}</Text></Card>)}</View>

  <View style={styles.quickGrid}>
   <Pressable accessibilityRole="button" onPress={()=>onNavigate('operations')} style={({pressed})=>[styles.quick,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><Text style={[styles.quickNumber,{color:theme.colors.amber}]}>{snapshot.summary.openTasks.toLocaleString('ar-SA')}</Text><Text style={[styles.quickLabel,{color:theme.colors.text}]}>مهام مفتوحة</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={()=>onNavigate('operations')} style={({pressed})=>[styles.quick,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><Text style={[styles.quickNumber,{color:theme.colors.red}]}>{snapshot.summary.lowStock.toLocaleString('ar-SA')}</Text><Text style={[styles.quickLabel,{color:theme.colors.text}]}>مخزون منخفض</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={()=>onNavigate('reports')} style={({pressed})=>[styles.quick,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><Text style={[styles.quickNumber,{color:theme.colors.mint}]}>{money(snapshot.summary.todayRevenue,snapshot.workspace.currency)}</Text><Text style={[styles.quickLabel,{color:theme.colors.text}]}>مبيعات اليوم</Text></Pressable>
  </View>

  <SectionTitle theme={theme} title="تنبيهات أوربي" caption="مرتبة حسب الأولوية والأحدث" action={<Pressable onPress={()=>onNavigate('orby')}><Text style={{color:theme.colors.mint,fontSize:12,fontWeight:'800'}}>اسأل أوربي</Text></Pressable>}/>
  {snapshot.alerts.length?snapshot.alerts.slice(0,5).map(alert=><Pressable key={alert.id} accessibilityRole="button" onPress={()=>onNavigate('orby')} style={({pressed})=>[styles.alert,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,opacity:pressed?0.72:1}]}><View style={[styles.alertRail,{backgroundColor:toneForAlert(alert)==='red'?theme.colors.red:toneForAlert(alert)==='amber'?theme.colors.amber:toneForAlert(alert)==='mint'?theme.colors.mint:theme.colors.sky}]}/><View style={styles.alertBody}><View style={styles.alertTitleRow}><Text style={[styles.alertTitle,{color:theme.colors.text}]}>{alert.title}</Text><Badge theme={theme} label={alert.severity==='critical'?'حرج':alert.severity==='warning'?'تنبيه':'معلومة'} tone={toneForAlert(alert)}/></View><Text numberOfLines={3} style={[styles.alertText,{color:theme.colors.muted}]}>{alert.body}</Text><Text style={[styles.alertTime,{color:theme.colors.faint}]}>{freshness(alert.generatedAt)}</Text></View></Pressable>):<Card theme={theme}><Text style={[styles.calm,{color:theme.colors.muted}]}>لا توجد تنبيهات نشطة حاليًا. سيظهر أوربي هنا أي تغير غير طبيعي أو فرصة مهمة.</Text></Card>}
 </ScrollView>;
}

const styles=StyleSheet.create({content:{padding:20,paddingBottom:30,gap:14},workspaceButton:{maxWidth:145,minHeight:42,borderWidth:1,borderRadius:14,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:7},workspaceName:{fontSize:11,fontWeight:'800',maxWidth:105},statusTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:10},statusText:{flex:1,alignItems:'flex-start'},statusTitle:{fontSize:19,fontWeight:'800',textAlign:'right'},statusBody:{fontSize:12,lineHeight:19,textAlign:'right',marginTop:4},syncLine:{marginTop:16,paddingTop:13,borderTopWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},syncLabel:{fontSize:11},syncValue:{fontSize:11,fontWeight:'800'},metricGrid:{flexDirection:'row',gap:9},metricCard:{flex:1,minHeight:142,padding:13},metricOrb:{width:30,height:30,borderRadius:11,alignItems:'center',justifyContent:'center',marginBottom:15},metricValue:{fontSize:15,fontWeight:'900',textAlign:'right'},metricLabel:{fontSize:10,lineHeight:15,textAlign:'right',marginTop:4},quickGrid:{flexDirection:'row',gap:9},quick:{flex:1,borderWidth:1,borderRadius:18,padding:13,minHeight:84,justifyContent:'center',alignItems:'flex-start'},quickNumber:{fontSize:14,fontWeight:'900',textAlign:'right'},quickLabel:{fontSize:10,fontWeight:'700',marginTop:5,textAlign:'right'},alert:{borderWidth:1,borderRadius:19,overflow:'hidden',flexDirection:'row'},alertRail:{width:4},alertBody:{flex:1,padding:14,alignItems:'flex-start'},alertTitleRow:{width:'100%',flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:8},alertTitle:{fontSize:14,fontWeight:'800',textAlign:'right',flex:1},alertText:{fontSize:12,lineHeight:19,textAlign:'right',marginTop:7},alertTime:{fontSize:10,marginTop:8},calm:{fontSize:13,lineHeight:21,textAlign:'right'}});
