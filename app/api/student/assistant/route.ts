import {generateText} from 'ai';
import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';
const modes={
 PLAN:'أنشئ خطة مذاكرة عملية مرتبة بالأيام والأولويات وفترات الراحة.',
 SUMMARY:'لخّص النص بدقة في عناوين ونقاط، ثم استخرج أهم المفاهيم.',
 QUIZ:'أنشئ اختبار مراجعة متوازنًا مع الأسئلة أولًا ثم الإجابات في قسم منفصل.',
 EXPLAIN:'اشرح الفكرة بالعربية الواضحة تدريجيًا مع مثال وتحقق قصير للفهم.'
} as const;

export async function POST(request:Request){
 try{
  const user=await currentUser();if(!user)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
  const body=await request.json() as {organizationId?:string;mode?:keyof typeof modes;prompt?:string};
  const organizationId=String(body.organizationId||''),mode=body.mode&&modes[body.mode]?body.mode:null,prompt=String(body.prompt||'').trim();
  if(!organizationId||!mode||prompt.length<10||prompt.length>12000)return NextResponse.json({error:'أدخل طلبًا واضحًا بين 10 و12000 حرف.'},{status:400});
  const membership=await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=organization_id,organizations(type,status)`);
  if(membership?.[0]?.organizations?.type!=='STUDENT'||membership[0].organizations.status!=='active')return NextResponse.json({error:'لا تملك صلاحية استخدام هذه المساحة.'},{status:403});
  const {text}=await generateText({
   model:'google/gemini-3-flash',
   system:'أنت مساعد مَدار الجامعي. أجب بالعربية الفصحى الواضحة، لا تختلق مراجع أو حقائق، وصرّح عندما تنقص المعلومات. لا تقدم إجابات للغش أثناء اختبار قائم. اجعل النتيجة عملية ومنظمة وقابلة للتطبيق.',
   prompt:`المهمة: ${modes[mode]}\n\nمحتوى الطالب:\n${prompt}`,
   maxOutputTokens:1800,
   providerOptions:{gateway:{user:user.id,tags:['feature:student-assistant','product:madar']}}
  });
  await supabaseFetch('/rest/v1/student_ai_history',{method:'POST',body:JSON.stringify({organization_id:organizationId,user_id:user.id,mode,prompt_excerpt:prompt.slice(0,500),response:text})});
  return NextResponse.json({text});
 }catch(error){
  console.error('Student assistant failed',error instanceof Error?error.message:'unknown');
  return NextResponse.json({error:'المساعد الذكي غير متاح الآن. بقية أدوات مساحة الطالب تعمل بصورة طبيعية.'},{status:503});
 }
}
