import type {ReactNode} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import type {MadarTheme} from '@/theme';
import type {Tab,WorkspaceChoice} from '@/types';

export function BrandMark({theme,large=false}:{theme:MadarTheme;large?:boolean}){
 return <View accessibilityLabel="مَدار" style={[styles.brand,{width:large?72:44,height:large?72:44,borderRadius:large?24:15,backgroundColor:theme.colors.mint}]}><Text style={[styles.brandText,{fontSize:large?34:21}]}>م</Text></View>;
}

export function ScreenHeader({theme,eyebrow,title,description,action}:{theme:MadarTheme;eyebrow?:string;title:string;description?:string;action?:ReactNode}){
 return <View style={styles.header}>
  <View style={styles.headerText}>{eyebrow?<Text style={[styles.eyebrow,{color:theme.colors.mint}]}>{eyebrow}</Text>:null}<Text accessibilityRole="header" style={[styles.title,{color:theme.colors.text}]}>{title}</Text>{description?<Text style={[styles.description,{color:theme.colors.muted}]}>{description}</Text>:null}</View>
  {action}
 </View>;
}

export function Card({theme,children,accent,style}:{theme:MadarTheme;children:ReactNode;accent?:string;style?:object}){
 return <View style={[styles.card,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border},accent?{borderTopColor:accent,borderTopWidth:2}:null,style]}>{children}</View>;
}

export function SectionTitle({theme,title,caption,action}:{theme:MadarTheme;title:string;caption?:string;action?:ReactNode}){
 return <View style={styles.sectionTitle}><View style={styles.sectionText}><Text style={[styles.sectionHeading,{color:theme.colors.text}]}>{title}</Text>{caption?<Text style={[styles.sectionCaption,{color:theme.colors.muted}]}>{caption}</Text>:null}</View>{action}</View>;
}

export function Badge({theme,label,tone='neutral'}:{theme:MadarTheme;label:string;tone?:'neutral'|'mint'|'amber'|'red'|'violet'|'sky'}){
 const palette=tone==='mint'?[theme.colors.mintSoft,theme.colors.mint]:tone==='amber'?[theme.colors.amberSoft,theme.colors.amber]:tone==='red'?[theme.colors.redSoft,theme.colors.red]:tone==='violet'?[theme.colors.violetSoft,theme.colors.violet]:tone==='sky'?[theme.colors.skySoft,theme.colors.sky]:[theme.colors.surfaceElevated,theme.colors.muted];
 return <View style={[styles.badge,{backgroundColor:palette[0]}]}><Text style={[styles.badgeText,{color:palette[1]}]}>{label}</Text></View>;
}

export function Button({theme,label,onPress,disabled=false,loading=false,kind='primary',compact=false,accessibilityHint}:{theme:MadarTheme;label:string;onPress:()=>void;disabled?:boolean;loading?:boolean;kind?:'primary'|'secondary'|'danger'|'ghost';compact?:boolean;accessibilityHint?:string}){
 const primary=kind==='primary',danger=kind==='danger';
 const background=primary?theme.colors.mint:danger?theme.colors.red:kind==='ghost'?'transparent':theme.colors.surfaceElevated;
 const color=primary||danger?'#07100F':kind==='ghost'?theme.colors.muted:theme.colors.text;
 return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{disabled:disabled||loading,busy:loading}} disabled={disabled||loading} onPress={onPress} style={({pressed})=>[styles.button,{backgroundColor:background,borderColor:kind==='ghost'?theme.colors.border:background,paddingVertical:compact?9:13,opacity:disabled?0.42:pressed?0.76:1}]}>{loading?<ActivityIndicator size="small" color={color}/>:<Text style={[styles.buttonText,{color}]}>{label}</Text>}</Pressable>;
}

export function ErrorBanner({theme,message,offline=false}:{theme:MadarTheme;message:string;offline?:boolean}){
 return <View accessibilityRole="alert" style={[styles.banner,{backgroundColor:offline?theme.colors.amberSoft:theme.colors.redSoft,borderColor:offline?theme.colors.amber:theme.colors.red}]}><Text style={[styles.bannerIcon,{color:offline?theme.colors.amber:theme.colors.red}]}>{offline?'◌':'!'}</Text><Text style={[styles.bannerText,{color:theme.colors.text}]}>{message}</Text></View>;
}

export function EmptyState({theme,title,body,symbol='◇'}:{theme:MadarTheme;title:string;body:string;symbol?:string}){
 return <View style={styles.empty}><View style={[styles.emptySymbol,{backgroundColor:theme.colors.surfaceElevated}]}><Text style={{color:theme.colors.mint,fontSize:25}}>{symbol}</Text></View><Text style={[styles.emptyTitle,{color:theme.colors.text}]}>{title}</Text><Text style={[styles.emptyBody,{color:theme.colors.muted}]}>{body}</Text></View>;
}

export function LoadingView({theme,label='جارٍ التحميل…'}:{theme:MadarTheme;label?:string}){
 return <View style={styles.loading}><BrandMark theme={theme} large/><ActivityIndicator color={theme.colors.mint}/><Text style={[styles.loadingText,{color:theme.colors.muted}]}>{label}</Text></View>;
}

const navItems:Array<{key:Tab;label:string;symbol:string}>=[
 {key:'home',label:'الرئيسية',symbol:'⌂'},{key:'reports',label:'التقارير',symbol:'▥'},{key:'operations',label:'العمليات',symbol:'✓'},{key:'orby',label:'أوربي',symbol:'✦'},{key:'account',label:'الحساب',symbol:'○'},
];

export function BottomNav({theme,active,onChange,attention=false}:{theme:MadarTheme;active:Tab;onChange:(tab:Tab)=>void;attention?:boolean}){
 return <View accessibilityRole="tablist" style={[styles.nav,{backgroundColor:theme.colors.nav,borderColor:theme.colors.border}]}>{navItems.map(item=>{const selected=active===item.key;return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected}} onPress={()=>onChange(item.key)} style={({pressed})=>[styles.navItem,{opacity:pressed?0.72:1}]}><View style={[styles.navIcon,selected?{backgroundColor:theme.colors.mintSoft}:null]}><Text style={[styles.navSymbol,{color:selected?theme.colors.mint:theme.colors.faint}]}>{item.symbol}</Text>{attention&&item.key==='operations'?<View style={[styles.dot,{backgroundColor:theme.colors.red}]}/>:null}</View><Text numberOfLines={1} style={[styles.navLabel,{color:selected?theme.colors.text:theme.colors.faint}]}>{item.label}</Text></Pressable>})}</View>;
}

export function WorkspaceSwitcher({theme,visible,workspaces,activeId,onClose,onSelect}:{theme:MadarTheme;visible:boolean;workspaces:WorkspaceChoice[];activeId:string;onClose:()=>void;onSelect:(id:string)=>void}){
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.modalBackdrop} onPress={onClose}><Pressable accessibilityViewIsModal style={[styles.sheet,{backgroundColor:theme.colors.surface,borderColor:theme.colors.border}]} onPress={()=>undefined}><View style={[styles.handle,{backgroundColor:theme.colors.border}]}/><SectionTitle theme={theme} title="تبديل مساحة العمل" caption="ستتحدث البيانات والمحادثات والصلاحيات للمساحة المختارة."/><ScrollView style={{maxHeight:360}}>{workspaces.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:item.id===activeId}} onPress={()=>onSelect(item.id)} style={({pressed})=>[styles.workspace,{borderColor:item.id===activeId?theme.colors.mint:theme.colors.border,backgroundColor:item.id===activeId?theme.colors.mintSoft:theme.colors.surfaceElevated,opacity:pressed?0.72:1}]}><View style={styles.workspaceText}><Text style={[styles.workspaceName,{color:theme.colors.text}]}>{item.name}</Text><Text style={[styles.workspaceRole,{color:theme.colors.muted}]}>{item.role}</Text></View>{item.id===activeId?<Text style={{color:theme.colors.mint,fontSize:20}}>✓</Text>:null}</Pressable>)}</ScrollView><Button theme={theme} kind="ghost" label="إغلاق" onPress={onClose}/></Pressable></Pressable></Modal>;
}

const styles=StyleSheet.create({
 brand:{alignItems:'center',justifyContent:'center',shadowColor:'#70E4D4',shadowOpacity:.18,shadowRadius:18,shadowOffset:{width:0,height:8}},brandText:{fontWeight:'900',color:'#07100F'},
 header:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:14,marginBottom:20},headerText:{flex:1,alignItems:'flex-start'},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:.8,marginBottom:6,textAlign:'right'},title:{fontSize:28,lineHeight:36,fontWeight:'900',textAlign:'right'},description:{fontSize:14,lineHeight:22,marginTop:5,textAlign:'right'},
 card:{borderWidth:1,borderRadius:23,padding:18,overflow:'hidden'},sectionTitle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:12},sectionText:{flex:1,alignItems:'flex-start'},sectionHeading:{fontSize:18,fontWeight:'800',textAlign:'right'},sectionCaption:{fontSize:12,lineHeight:18,marginTop:3,textAlign:'right'},
 badge:{alignSelf:'flex-start',borderRadius:999,paddingHorizontal:10,paddingVertical:5},badgeText:{fontSize:11,fontWeight:'800'},button:{minHeight:42,borderRadius:14,paddingHorizontal:15,borderWidth:1,alignItems:'center',justifyContent:'center'},buttonText:{fontSize:13,fontWeight:'800'},
 banner:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderRadius:16,padding:13,marginBottom:14},bannerIcon:{fontSize:18,fontWeight:'900'},bannerText:{flex:1,fontSize:12,lineHeight:18,textAlign:'right'},
 empty:{alignItems:'center',paddingVertical:32,paddingHorizontal:20},emptySymbol:{width:52,height:52,borderRadius:18,alignItems:'center',justifyContent:'center',marginBottom:12},emptyTitle:{fontSize:16,fontWeight:'800',textAlign:'center'},emptyBody:{fontSize:13,lineHeight:20,textAlign:'center',marginTop:5,maxWidth:310},
 loading:{flex:1,alignItems:'center',justifyContent:'center',gap:16,padding:32},loadingText:{fontSize:14,textAlign:'center'},
 nav:{height:72,borderTopWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:4,paddingBottom:4},navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:3},navIcon:{width:38,height:30,borderRadius:13,alignItems:'center',justifyContent:'center'},navSymbol:{fontSize:19,fontWeight:'800'},navLabel:{fontSize:10,fontWeight:'700'},dot:{position:'absolute',width:7,height:7,borderRadius:4,top:3,right:5},
 modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.55)'},sheet:{borderTopLeftRadius:28,borderTopRightRadius:28,borderWidth:1,padding:20,paddingBottom:30,maxHeight:'80%'},handle:{width:44,height:4,borderRadius:3,alignSelf:'center',marginBottom:20},workspace:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderRadius:18,padding:15,marginBottom:10},workspaceText:{flex:1,alignItems:'flex-start'},workspaceName:{fontSize:15,fontWeight:'800',textAlign:'right'},workspaceRole:{fontSize:11,marginTop:4},
});
