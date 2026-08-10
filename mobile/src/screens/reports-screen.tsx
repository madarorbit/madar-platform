import {RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Badge,Card,ScreenHeader,SectionTitle} from '@/components/ui';
import {money,verticalLabel} from '@/lib/format';
import type {MadarTheme} from '@/theme';
import type {DashboardSnapshot} from '@/types';

type Props={theme:MadarTheme;snapshot:DashboardSnapshot;refreshing:boolean;onRefresh:()=>void};
const numeric=(value:unknown)=>Number(value||0);

function verticalKpis(snapshot:DashboardSnapshot){
 const report=snapshot.summary.sector,currency=snapshot.workspace.currency;
 if(snapshot.vertical.extension==='food_service')return[
  ['الطلبات المكتملة',numeric(report.completed_orders).toLocaleString('ar-SA')],['الإيراد',money(numeric(report.revenue),currency)],['تكلفة المكونات',money(numeric(report.ingredient_cost),currency)],['الربح الإجمالي',money(numeric(report.gross_profit),currency)],
 ];
 if(snapshot.vertical.extension==='hospitality')return[
  ['الغرف المتاحة',numeric(report.available_rooms).toLocaleString('ar-SA')],['الغرف المشغولة',numeric(report.occupied_rooms).toLocaleString('ar-SA')],['نسبة الإشغال',`${numeric(report.occupancy_rate).toFixed(1)}%`],['إيراد الغرف',money(numeric(report.room_revenue),currency)],
 ];
 return[
  ['المبيعات',money(numeric(report.sales_total)||snapshot.summary.revenue30d,currency)],['تكلفة البضاعة',money(numeric(report.cost_of_goods),currency)],['المصروفات',money(numeric(report.expenses_total)||snapshot.summary.expenses30d,currency)],['صافي الربح',money(numeric(report.net_profit)||snapshot.summary.profit30d,currency)],
 ];
}

export function ReportsScreen({theme,snapshot,refreshing,onRefresh}:Props){
 const currency=snapshot.workspace.currency,maximum=Math.max(1,...snapshot.dailySeries.flatMap(item=>[item.revenue,item.expenses])),kpis=verticalKpis(snapshot);
 return <ScrollView style={{backgroundColor:theme.colors.background}} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.mint}/>}>
  <ScreenHeader theme={theme} eyebrow={`تقارير ${verticalLabel(snapshot.vertical.extension)}`} title="الأداء بوضوح" description="الأرقام التالية من مصدر الحقيقة النشط، وليست تقديرات من النموذج." action={<Badge theme={theme} label="آخر 30 يومًا" tone="violet"/>}/>
  <View style={styles.heroRow}><Card theme={theme} accent={snapshot.summary.profit30d>=0?theme.colors.mint:theme.colors.red} style={styles.heroCard}><Text style={[styles.heroLabel,{color:theme.colors.muted}]}>صافي النتيجة</Text><Text style={[styles.heroValue,{color:snapshot.summary.profit30d>=0?theme.colors.mint:theme.colors.red}]}>{money(snapshot.summary.profit30d,currency)}</Text><Text style={[styles.heroCaption,{color:theme.colors.faint}]}>الإيراد مطروحًا منه المصروفات المسجلة</Text></Card><Card theme={theme} style={styles.heroSmall}><Text style={[styles.heroLabel,{color:theme.colors.muted}]}>إيراد اليوم</Text><Text style={[styles.smallValue,{color:theme.colors.text}]}>{money(snapshot.summary.todayRevenue,currency)}</Text></Card></View>

  <SectionTitle theme={theme} title="اتجاه آخر 7 أيام" caption="الإيرادات مقابل المصروفات"/>
  <Card theme={theme}>
   <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:theme.colors.mint}]}/><Text style={[styles.legendText,{color:theme.colors.muted}]}>إيراد</Text></View><View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:theme.colors.violet}]}/><Text style={[styles.legendText,{color:theme.colors.muted}]}>مصروف</Text></View></View>
   <View style={styles.chart}>{snapshot.dailySeries.map(item=><View key={item.date} style={styles.day}><View style={styles.bars}><View accessibilityLabel={`${item.label}: الإيراد ${money(item.revenue,currency)}`} style={[styles.bar,{height:Math.max(3,(item.revenue/maximum)*116),backgroundColor:theme.colors.mint}]}/><View accessibilityLabel={`${item.label}: المصروف ${money(item.expenses,currency)}`} style={[styles.bar,{height:Math.max(3,(item.expenses/maximum)*116),backgroundColor:theme.colors.violet}]}/></View><Text style={[styles.dayLabel,{color:theme.colors.faint}]}>{item.label}</Text></View>)}</View>
  </Card>

  <SectionTitle theme={theme} title={`تفاصيل ${verticalLabel(snapshot.vertical.extension)}`} caption={`مصطلحات ومؤشرات ${snapshot.vertical.name}`}/>
  <View style={styles.kpiGrid}>{kpis.map(([label,value],index)=><Card key={label} theme={theme} style={styles.kpi}><Text style={[styles.kpiLabel,{color:theme.colors.muted}]}>{label}</Text><Text style={[styles.kpiValue,{color:index===kpis.length-1?theme.colors.mint:theme.colors.text}]}>{value}</Text></Card>)}</View>

  <SectionTitle theme={theme} title="آخر العمليات المالية" caption="أحدث المبيعات المسجلة"/>
  <Card theme={theme}>{snapshot.recentSales.length?snapshot.recentSales.map((sale,index)=><View key={sale.id} style={[styles.sale,index>0?{borderTopWidth:1,borderTopColor:theme.colors.border}:null]}><View style={[styles.saleSymbol,{backgroundColor:theme.colors.mintSoft}]}><Text style={{color:theme.colors.mint}}>↗</Text></View><View style={styles.saleText}><Text style={[styles.saleTitle,{color:theme.colors.text}]}>عملية بيع</Text><Text style={[styles.saleDate,{color:theme.colors.faint}]}>{new Date(sale.soldAt).toLocaleString('ar-SA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</Text></View><Text style={[styles.saleAmount,{color:theme.colors.mint}]}>{money(sale.total,currency)}</Text></View>):<Text style={[styles.empty,{color:theme.colors.muted}]}>لا توجد مبيعات مكتملة في هذه الفترة.</Text>}</Card>
 </ScrollView>;
}

const styles=StyleSheet.create({content:{padding:20,paddingBottom:34,gap:14},heroRow:{flexDirection:'row',gap:10},heroCard:{flex:1.5,minHeight:145,justifyContent:'center'},heroSmall:{flex:1,minHeight:145,justifyContent:'center'},heroLabel:{fontSize:11,fontWeight:'700',textAlign:'right'},heroValue:{fontSize:23,fontWeight:'900',textAlign:'right',marginTop:9},smallValue:{fontSize:17,fontWeight:'900',textAlign:'right',marginTop:9},heroCaption:{fontSize:10,lineHeight:16,textAlign:'right',marginTop:7},legend:{flexDirection:'row',gap:15,marginBottom:17},legendItem:{flexDirection:'row',alignItems:'center',gap:6},legendDot:{width:8,height:8,borderRadius:4},legendText:{fontSize:10},chart:{height:155,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:5},day:{flex:1,alignItems:'center'},bars:{height:120,flexDirection:'row',alignItems:'flex-end',gap:3},bar:{width:8,borderRadius:6},dayLabel:{fontSize:9,marginTop:8},kpiGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},kpi:{width:'48%',minHeight:104,justifyContent:'center'},kpiLabel:{fontSize:11,textAlign:'right'},kpiValue:{fontSize:17,fontWeight:'900',textAlign:'right',marginTop:8},sale:{minHeight:66,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10},saleSymbol:{width:36,height:36,borderRadius:13,alignItems:'center',justifyContent:'center'},saleText:{flex:1,alignItems:'flex-start'},saleTitle:{fontSize:13,fontWeight:'800'},saleDate:{fontSize:10,marginTop:4},saleAmount:{fontSize:13,fontWeight:'900'},empty:{fontSize:13,textAlign:'center',paddingVertical:22}});
