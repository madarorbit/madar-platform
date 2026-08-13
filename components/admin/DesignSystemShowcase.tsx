'use client';

import {useState} from 'react';
import ThemePreferences from '@/components/theme/ThemePreferences';
import {
 Avatar,Badge,Button,Card,EmptyState,ErrorState,Field,Grid,IconButton,Input,Notice,
 Panel,SearchInput,Select,Skeleton,SkeletonGroup,Stack,StatusBadge,Table,TableWrap,
 Tabs,Textarea,
} from '@/components/ui/Enterprise';
import {Modal,Toast} from '@/components/ui/EnterpriseClient';
import {Icon} from '@/components/ui/Icons';

const tokens=[
 ['الخلفية','--md-background'],['السطح','--md-surface'],['سطح ثانوي','--md-surface-muted'],
 ['النص','--md-text-primary'],['النص الثانوي','--md-text-secondary'],['الحدود','--md-border-default'],
 ['البنفسجي','--md-accent'],['النعناعي','--md-mint'],['النجاح','--md-success'],['التحذير','--md-warning'],['الخطر','--md-danger'],
] as const;

function CatalogSection({title,description,children}:{title:string;description:string;children:React.ReactNode}){return <section className="md-ds-section"><header><h2 className="md-type-h2">{title}</h2><p className="md-type-body-sm md-muted">{description}</p></header>{children}</section>}

export default function DesignSystemShowcase(){
 const[modalOpen,setModalOpen]=useState(false),[toastOpen,setToastOpen]=useState(false),[tab,setTab]=useState('overview');
 return <Stack gap="lg">
  <CatalogSection title="Themes & semantic tokens" description="المكوّنات تستهلك الأدوار الدلالية؛ قيم الألوان الخام محصورة في ملف الرموز.">
   <div className="md-ds-theme-grid"><Panel><h3 className="md-type-h3 mb-4">المظهر الفعلي</h3><ThemePreferences/></Panel><div className="md-ds-theme-previews"><div className="md-theme-preview is-light"><strong>Light</strong><span>Background · Surface · Text · Accent</span></div><div className="md-theme-preview is-dark"><strong>Dark</strong><span>Background · Surface · Text · Accent</span></div></div></div>
   <div className="md-token-grid">{tokens.map(([label,token])=><div key={token} className="md-token-swatch"><span style={{background:`var(${token})`}}/><strong>{label}</strong><code dir="ltr">{token}</code></div>)}</div>
  </CatalogSection>

  <CatalogSection title="Typography & spacing" description="تسلسل عربي أولًا، أرقام tabular، ومسافات مبنية على شبكة 4px.">
   <Panel className="md-ds-type-samples"><p className="md-type-display">Display — مَدار</p><h1 className="md-type-h1">عنوان المستوى الأول</h1><h2 className="md-type-h2">عنوان المستوى الثاني</h2><h3 className="md-type-h3">عنوان المستوى الثالث</h3><p className="md-type-body-lg">نص كبير لشرح الفكرة الأساسية بوضوح.</p><p className="md-type-body">نص المحتوى القياسي مع English و<span className="md-ltr-data">INV-2048</span>.</p><p className="md-type-caption md-muted">Caption — تفاصيل مساندة</p><strong className="md-type-stat md-ltr-data">12,480.50</strong></Panel>
  </CatalogSection>

  <CatalogSection title="Buttons & icon actions" description="الأحجام والحالات والإجراء الخطر والتحميل من API واحد.">
   <div className="md-cluster"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button><Button variant="danger"><Icon name="warning"/>Danger</Button><Button variant="link">Link</Button><Button disabled>Disabled</Button><Button loading>Loading</Button><IconButton label="الإشعارات" badge={3}><Icon name="bell"/></IconButton></div>
  </CatalogSection>

  <CatalogSection title="Forms" description="Label وhelp وerror ضمن البنية نفسها مع focus واضح في الوضعين.">
   <Panel><div className="grid gap-4 md:grid-cols-2"><Field label="الاسم" help="اكتب الاسم الظاهر للمستخدمين"><Input placeholder="اسم الحساب"/></Field><Field label="الحالة"><Select defaultValue="active"><option value="active">نشط</option><option value="pending">قيد المراجعة</option></Select></Field><Field label="بحث"><SearchInput placeholder="ابحث في المكوّنات"/></Field><Field label="حقل بخطأ" error="هذه القيمة مطلوبة"><Input aria-invalid="true"/></Field><Field label="ملاحظات" className="md:col-span-2"><Textarea placeholder="اكتب ملاحظة قصيرة…"/></Field></div></Panel>
  </CatalogSection>

  <CatalogSection title="Cards, avatar & status" description="البطاقات ليست حاوية افتراضية لكل شيء، والحالة لا تعتمد على اللون وحده.">
   <Grid><Card><Avatar size="lg"/><h3 className="md-type-h3 mt-4">Avatar افتراضي</h3><p className="md-type-body-sm md-muted mt-2">Silhouette بشري موحد عند غياب الصورة.</p></Card><Card><div className="md-cluster"><StatusBadge status="active">نشط</StatusBadge><StatusBadge status="pending">قيد المراجعة</StatusBadge><StatusBadge status="rejected">مرفوض</StatusBadge><Badge variant="info">معلومة</Badge></div><h3 className="md-type-h3 mt-5">حالات مقروءة</h3><p className="md-type-body-sm md-muted mt-2">نقطة + نص + لون دلالي.</p></Card><Card interactive><span className="md-feature-icon is-mint"><Icon name="store"/></span><h3 className="md-type-h3 mt-4">Interactive card</h3><p className="md-type-body-sm md-muted mt-2">ارتفاع بسيط للشرح لا للزينة.</p></Card></Grid>
  </CatalogSection>

  <CatalogSection title="Tabs, table & responsive data" description="التبويبات للتقسيم المحلي فقط؛ الجدول ينتقل إلى قائمة دلالية على الهاتف.">
   <div><Tabs items={[{label:'نظرة عامة',href:'#overview',active:tab==='overview'},{label:'النشاط',href:'#activity',active:tab==='activity'}]}/><div className="mt-3 md-cluster"><Button size="sm" variant="ghost" onClick={()=>setTab(tab==='overview'?'activity':'overview')}>تبديل المثال</Button></div></div>
   <TableWrap><Table mobile="list"><caption>الخدمات المرجعية</caption><thead><tr><th>الخدمة</th><th>الحالة</th><th>الخطة</th><th>الإجراء</th></tr></thead><tbody><tr><td data-label="الخدمة">MADAR Retail</td><td data-label="الحالة"><StatusBadge status="active">نشط</StatusBadge></td><td data-label="الخطة">Business</td><td data-label="الإجراء"><Button size="sm" variant="ghost">فتح</Button></td></tr><tr><td data-label="الخدمة">تجارة مرتبطة</td><td data-label="الحالة"><StatusBadge status="pending">معلّق</StatusBadge></td><td data-label="الخطة">Starter</td><td data-label="الإجراء"><Button size="sm" variant="ghost">الحالة</Button></td></tr></tbody></Table></TableWrap>
  </CatalogSection>

  <CatalogSection title="Empty, error, loading & feedback" description="كل حالة لها مستوى وسياق وإجراء مناسب بدل رسالة عامة.">
   <Grid><EmptyState compact title="لا توجد منتجات بعد" description="أضف أول منتج لبدء البيع." action={<Button size="sm">إضافة منتج</Button>}/><ErrorState title="تعذر تحميل القسم" description="أعد المحاولة دون مغادرة الصفحة." action={<Button size="sm" variant="secondary">إعادة المحاولة</Button>}/><Panel><SkeletonGroup><Skeleton className="h-7 w-1/2"/><Skeleton/><Skeleton className="h-20 w-full"/></SkeletonGroup></Panel></Grid>
   <div className="mt-4 grid gap-3"><Notice title="تم حفظ التغييرات" variant="success">ستظهر القيمة الجديدة في الجلسة التالية.</Notice><Notice title="راجع المدخلات" variant="warning">يوجد حقل يحتاج انتباهك.</Notice></div>
  </CatalogSection>

  <CatalogSection title="Dialogs & toasts" description="Dialog للإجراء المركّز، وToast للتغذية الراجعة اللحظية فقط.">
   <div className="md-cluster"><Button onClick={()=>setModalOpen(true)}>فتح Dialog</Button><Button variant="secondary" onClick={()=>setToastOpen(true)}>إظهار Toast</Button></div>
   <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title="نموذج Dialog" description="يحافظ المتصفح على focus trap ويعمل بزر Escape." footer={<><Button variant="secondary" onClick={()=>setModalOpen(false)}>إلغاء</Button><Button onClick={()=>setModalOpen(false)}>حفظ</Button></>}><Field label="اسم العرض"><Input defaultValue="مَدار"/></Field></Modal>
   {toastOpen?<Toast title="تم الحفظ" message="تم تحديث إعدادات المكوّن." variant="success" onClose={()=>setToastOpen(false)}/>:null}
  </CatalogSection>
 </Stack>;
}
