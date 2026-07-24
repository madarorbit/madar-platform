-- Store Engine seed catalog. Every new item starts draft, hidden and inactive.
begin;

insert into public.categories(name,slug,description,is_active,visibility,sort_order) values
 ('التجارة والأعمال','commerce-business','أنظمة وأدوات تشغيل التجارة والأعمال.',false,'hidden',10),
 ('الذكاء الاصطناعي','artificial-intelligence','أدوات وبرومبتات وحلول الذكاء الاصطناعي.',false,'hidden',20),
 ('القوالب','templates','قوالب رقمية احترافية قابلة للتخصيص.',false,'hidden',30),
 ('الطلاب','students','موارد وأدوات مخصصة للطلاب الجامعيين.',false,'hidden',40),
 ('الأنظمة','systems','أنظمة ومواقع جاهزة وقابلة للتخصيص.',false,'hidden',50),
 ('الخدمات','services','خدمات مَدار البرمجية والتقنية والإبداعية.',false,'hidden',60),
 ('الاشتراكات والباقات','subscriptions-plans','اشتراكات وباقات مَدار القابلة للتفعيل من لوحة الإدارة.',false,'hidden',70)
on conflict(slug) do nothing;

insert into public.subcategories(category_id,name,slug,description,is_active,visibility,sort_order)
select c.id,v.name,v.slug,v.description,false,'hidden',v.sort_order
from (values
 ('services','البرمجة','programming-services','تطوير وإصلاح وتحسين البرمجيات.',10),
 ('services','الذكاء الاصطناعي','ai-services','بناء ودمج وأتمتة حلول الذكاء الاصطناعي.',20),
 ('services','التصميم','design-services','الشعارات والهويات وتجربة المستخدم والمحتوى البصري.',30),
 ('services','التسويق','marketing-services','إدارة وتسويق المحتوى والحملات والظهور.',40),
 ('services','التجارة الإلكترونية','ecommerce-services','إنشاء وربط وتحسين المتاجر الإلكترونية.',50),
 ('services','الاستشارات','consulting-services','استشارات أعمال وتقنية وذكاء اصطناعي وتسويق.',60),
 ('templates','Notion','notion-templates','قوالب Notion.',10),
 ('templates','Excel','excel-templates','قوالب Excel.',20),
 ('templates','Google Sheets','google-sheets-templates','قوالب Google Sheets.',30),
 ('templates','Word','word-templates','قوالب Word.',40),
 ('templates','PowerPoint','powerpoint-templates','قوالب PowerPoint.',50),
 ('templates','Canva','canva-templates','قوالب Canva.',60)
) as v(category_slug,name,slug,description,sort_order)
join public.categories c on c.slug=v.category_slug
on conflict(slug) do nothing;

insert into public.tags(name,slug,description,is_active) values
 ('منتج رقمي','digital-product','تسليم رقمي.',false),
 ('نظام جاهز','ready-system','نظام جاهز للتخصيص.',false),
 ('ذكاء اصطناعي','ai','حلول وموارد ذكاء اصطناعي.',false),
 ('أعمال','business','أدوات موجهة للأعمال.',false),
 ('طلاب','students','موارد طلابية.',false),
 ('قالب','template','قالب قابل للتعديل.',false)
on conflict(slug) do nothing;

insert into public.products(name,slug,short_description,price,currency,category_id,product_type,status,visibility,is_active,show_in_store,show_on_home,is_featured,requires_approval,is_free,sort_order)
select v.name,v.slug,v.description,0,'SAR',c.id,v.kind::public.store_item_type,'draft','hidden',false,false,false,false,true,false,v.sort_order
from (values
 ('commerce-business','نظام إدارة واتساب للأعمال Lite','whatsapp-business-lite','إصدار مبسط لتنظيم محادثات وعمليات واتساب للأعمال.','ready_system',10),
 ('commerce-business','نظام إدارة واتساب للأعمال Pro','whatsapp-business-pro','إصدار متقدم لإدارة واتساب للأعمال.','ready_system',20),
 ('commerce-business','نظام CRM','crm-system','نظام لإدارة العملاء والعلاقات والفرص.','ready_system',30),
 ('commerce-business','نظام إدارة الطلبات','order-management-system','نظام لتنظيم الطلبات وحالاتها.','ready_system',40),
 ('commerce-business','نظام إدارة المخزون','inventory-management-system','نظام لمتابعة المخزون والحركات والتنبيهات.','ready_system',50),
 ('commerce-business','نظام الفواتير','invoice-management-system','نظام لإنشاء الفواتير وتنظيمها.','ready_system',60),
 ('commerce-business','نظام إدارة المبيعات','sales-management-system','نظام لتسجيل المبيعات ومتابعة الأداء.','ready_system',70),
 ('commerce-business','نظام الموردين','supplier-management-system','نظام لإدارة الموردين والمشتريات.','ready_system',80),
 ('commerce-business','لوحة الأرباح','profit-dashboard','لوحة لمتابعة الأرباح والهوامش.','digital_product',90),
 ('commerce-business','لوحة التحليلات','analytics-dashboard','لوحة تحليلات تشغيلية للأعمال.','digital_product',100),
 ('artificial-intelligence','مكتبة البرومبتات','prompt-library','مكتبة منظمة من البرومبتات العملية.','digital_product',110),
 ('artificial-intelligence','برومبتات التسويق','marketing-prompts','برومبتات للتسويق وصناعة المحتوى.','digital_product',120),
 ('artificial-intelligence','برومبتات التجارة','commerce-prompts','برومبتات لإدارة وتنمية التجارة.','digital_product',130),
 ('artificial-intelligence','برومبتات البرمجة','programming-prompts','برومبتات للمساعدة في التطوير البرمجي.','digital_product',140),
 ('artificial-intelligence','برومبتات الإدارة','management-prompts','برومبتات للإدارة والتخطيط واتخاذ القرار.','digital_product',150),
 ('artificial-intelligence','برومبتات خدمة العملاء','customer-service-prompts','برومبتات لخدمة العملاء والدعم.','digital_product',160),
 ('artificial-intelligence','برومبتات التعليم','education-prompts','برومبتات للتعليم والتعلم.','digital_product',170),
 ('artificial-intelligence','برومبتات البحث العلمي','research-prompts','برومبتات منظمة للبحث العلمي.','digital_product',180),
 ('templates','قوالب Notion','notion-templates','قوالب Notion احترافية.','template',190),
 ('templates','قوالب Excel','excel-templates','قوالب Excel للأعمال والإدارة.','template',200),
 ('templates','قوالب Google Sheets','google-sheets-templates','قوالب Google Sheets مرنة.','template',210),
 ('templates','قوالب Word','word-templates','قوالب Word رسمية وعملية.','template',220),
 ('templates','قوالب PowerPoint','powerpoint-templates','قوالب عروض تقديمية احترافية.','template',230),
 ('templates','قوالب Canva','canva-templates','قوالب Canva قابلة للتخصيص.','template',240),
 ('templates','قوالب العقود','contract-templates','قوالب عقود قابلة للتعديل.','template',250),
 ('templates','قوالب SOP','sop-templates','قوالب إجراءات تشغيل قياسية.','template',260),
 ('students','ملخصات','student-summaries','ملخصات ومواد دراسية منظمة.','student_resource',270),
 ('students','قوالب أبحاث','research-templates','قوالب أكاديمية للأبحاث.','student_resource',280),
 ('students','CV','student-cv','قوالب سيرة ذاتية للطلاب والخريجين.','student_resource',290),
 ('students','مشاريع تخرج','graduation-projects','نماذج وأدوات لمشاريع التخرج.','student_resource',300),
 ('students','جداول مذاكرة','study-schedules','جداول وخطط لتنظيم المذاكرة.','student_resource',310),
 ('systems','متجر إلكتروني','ecommerce-store-system','متجر إلكتروني جاهز للتخصيص.','ready_system',320),
 ('systems','موقع شركة','company-website-system','موقع شركة مؤسسي جاهز للتخصيص.','ready_system',330),
 ('systems','موقع شخصي','personal-website-system','موقع شخصي احترافي.','ready_system',340),
 ('systems','ERP','erp-system','نظام تخطيط موارد المؤسسة.','ready_system',350),
 ('systems','CRM','crm-ready-system','نظام إدارة علاقات العملاء.','ready_system',360),
 ('systems','POS','pos-system','نظام نقاط بيع.','ready_system',370),
 ('systems','LMS','lms-system','نظام إدارة تعلم.','ready_system',380),
 ('systems','نظام إدارة مطعم','restaurant-management-system','نظام لإدارة عمليات المطاعم.','ready_system',390),
 ('systems','نظام إدارة صيدلية','pharmacy-management-system','نظام لإدارة الصيدليات.','ready_system',400),
 ('systems','نظام إدارة مدرسة','school-management-system','نظام لإدارة المدارس.','ready_system',410),
 ('systems','نظام إدارة مستشفى','hospital-management-system','نظام لإدارة المنشآت الصحية.','ready_system',420),
 ('systems','نظام حجوزات','booking-system','نظام للحجوزات والمواعيد.','ready_system',430)
) as v(category_slug,name,slug,description,kind,sort_order)
join public.categories c on c.slug=v.category_slug
on conflict(slug) do nothing;

insert into public.services(name,slug,short_description,price_from,currency,category_id,subcategory_id,service_type,status,visibility,is_active,show_in_store,show_on_home,is_featured,requires_approval,is_free,sort_order)
select v.name,v.slug,v.description,0,'SAR',c.id,sc.id,'service','draft','hidden',false,false,false,false,true,false,v.sort_order
from (values
 ('programming-services','تطوير موقع','website-development','تطوير موقع احترافي حسب الاحتياج.',10),
 ('programming-services','تطوير متجر','store-development','تطوير متجر إلكتروني قابل للتوسع.',20),
 ('programming-services','تطوير نظام','system-development','تطوير نظام مخصص للأعمال.',30),
 ('programming-services','إصلاح أخطاء','bug-fixing','تحليل وإصلاح الأخطاء البرمجية.',40),
 ('programming-services','تحسين الأداء','performance-optimization','تحسين سرعة وكفاءة الأنظمة والمواقع.',50),
 ('ai-services','بناء وكيل AI','ai-agent-development','بناء وكيل ذكاء اصطناعي مخصص.',60),
 ('ai-services','دمج ChatGPT','chatgpt-integration','دمج ChatGPT داخل الأنظمة والعمليات.',70),
 ('ai-services','دمج Gemini','gemini-integration','دمج Gemini داخل الأنظمة والعمليات.',80),
 ('ai-services','أتمتة الأعمال','business-automation-service','أتمتة العمليات المتكررة وربط الأدوات.',90),
 ('design-services','شعار','logo-design','تصميم شعار احترافي.',100),
 ('design-services','هوية بصرية','visual-identity','تصميم هوية بصرية متكاملة.',110),
 ('design-services','UI','ui-design','تصميم واجهات مستخدم احترافية.',120),
 ('design-services','UX','ux-design','تصميم وتحسين تجربة المستخدم.',130),
 ('design-services','منشورات','social-post-design','تصميم منشورات رقمية.',140),
 ('design-services','إعلانات','advertising-design','تصميم مواد إعلانية.',150),
 ('marketing-services','إدارة الحسابات','social-account-management','إدارة حسابات التواصل الاجتماعي.',160),
 ('marketing-services','كتابة المحتوى','content-writing','كتابة محتوى تسويقي ومؤسسي.',170),
 ('marketing-services','SEO','seo-service','تحسين الظهور في محركات البحث.',180),
 ('marketing-services','حملات إعلانية','advertising-campaigns','تخطيط وإدارة الحملات الإعلانية.',190),
 ('ecommerce-services','إنشاء متجر','create-online-store','إنشاء متجر إلكتروني متكامل.',200),
 ('ecommerce-services','ربط الدفع','payment-integration','ربط وسائل الدفع بالمتجر أو النظام.',210),
 ('ecommerce-services','تحسين المتجر','store-optimization','تحسين تجربة وأداء المتجر.',220),
 ('consulting-services','استشارة أعمال','business-consulting','استشارة لتطوير وتشغيل الأعمال.',230),
 ('consulting-services','استشارة تقنية','technical-consulting','استشارة تقنية للأنظمة والمنتجات.',240),
 ('consulting-services','استشارة AI','ai-consulting','استشارة لاستخدام الذكاء الاصطناعي بفعالية.',250),
 ('consulting-services','استشارة تسويق','marketing-consulting','استشارة للتسويق والنمو.',260)
) as v(subcategory_slug,name,slug,description,sort_order)
join public.subcategories sc on sc.slug=v.subcategory_slug
join public.categories c on c.id=sc.category_id
on conflict(slug) do nothing;

insert into public.store_settings(setting_key,setting_value,description,is_public) values
 ('general','{"store_name":"متجر مَدار | ORBIT","default_currency":"SAR","items_per_page":12,"search_debounce_ms":250}'::jsonb,'الإعدادات العامة لمحرك المتجر.',true),
 ('display','{"show_ratings":true,"show_sales_count":false,"show_categories":true,"show_filters":true}'::jsonb,'إعدادات العرض العامة.',true),
 ('checkout','{"mode":"manual_approval","allow_external_purchase_links":true}'::jsonb,'إعدادات الطلب والدفع.',false)
on conflict(setting_key) do nothing;

commit;
