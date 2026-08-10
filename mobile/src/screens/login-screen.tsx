import {useState} from 'react';
import {KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {supabase} from '@/lib/supabase';
import type {MadarTheme} from '@/theme';
import {BrandMark,Button,Card,ErrorBanner} from '@/components/ui';

export function LoginScreen({theme}:{theme:MadarTheme}){
 const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState<string|null>(null);
 async function signIn(){
  if(!email.trim()||!password){setError('أدخل البريد الإلكتروني وكلمة المرور.');return;}
  setLoading(true);setError(null);
  const{error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  if(authError)setError(authError.status===429?'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.':'تعذر تسجيل الدخول. تحقق من البيانات وتفعيل الحساب.');
  setLoading(false);
 }
 return <KeyboardAvoidingView style={[styles.flex,{backgroundColor:theme.colors.background}]} behavior={Platform.OS==='ios'?'padding':undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
   <View style={styles.hero}><BrandMark theme={theme} large/><Text style={[styles.eyebrow,{color:theme.colors.mint}]}>MADAR DASHBOARD V2.0</Text><Text style={[styles.title,{color:theme.colors.text}]}>تجارتك معك، أينما كنت</Text><Text style={[styles.body,{color:theme.colors.muted}]}>راقب الأداء، تابع العمليات اليومية، واستكمل محادثات أوربي من الهاتف بصلاحيات مساحة العمل نفسها.</Text></View>
   <Card theme={theme} style={styles.card}>
    <Text style={[styles.cardTitle,{color:theme.colors.text}]}>الدخول إلى مساحة العمل</Text>
    {error?<ErrorBanner theme={theme} message={error}/>:null}
    <Text style={[styles.label,{color:theme.colors.muted}]}>البريد الإلكتروني</Text>
    <TextInput accessibilityLabel="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" placeholder="name@example.com" placeholderTextColor={theme.colors.faint} style={[styles.input,{color:theme.colors.text,backgroundColor:theme.colors.surfaceElevated,borderColor:theme.colors.border}]}/>
    <Text style={[styles.label,{color:theme.colors.muted}]}>كلمة المرور</Text>
    <TextInput accessibilityLabel="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" returnKeyType="done" onSubmitEditing={signIn} placeholder="••••••••" placeholderTextColor={theme.colors.faint} style={[styles.input,{color:theme.colors.text,backgroundColor:theme.colors.surfaceElevated,borderColor:theme.colors.border}]}/>
    <Button theme={theme} label="تسجيل الدخول" onPress={signIn} loading={loading}/>
    <Text style={[styles.note,{color:theme.colors.faint}]}>لا يخزن التطبيق مفاتيح أنظمتك أو مزودي الذكاء. كل إجراء كتابة يعرض معاينة ويتطلب تأكيدًا صريحًا.</Text>
   </Card>
  </ScrollView>
 </KeyboardAvoidingView>;
}

const styles=StyleSheet.create({flex:{flex:1},content:{flexGrow:1,padding:22,paddingTop:54,paddingBottom:42,justifyContent:'center'},hero:{alignItems:'center',marginBottom:28},eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.4,marginTop:18},title:{fontSize:30,lineHeight:39,fontWeight:'900',textAlign:'center',marginTop:8},body:{fontSize:14,lineHeight:23,textAlign:'center',maxWidth:390,marginTop:8},card:{gap:10},cardTitle:{fontSize:19,fontWeight:'800',textAlign:'right',marginBottom:4},label:{fontSize:12,fontWeight:'700',textAlign:'right',marginTop:3},input:{height:52,borderWidth:1,borderRadius:15,paddingHorizontal:15,fontSize:15,textAlign:'right',writingDirection:'rtl'},note:{fontSize:11,lineHeight:18,textAlign:'center',marginTop:4}});
