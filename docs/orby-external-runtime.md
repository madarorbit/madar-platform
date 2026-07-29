# ORBY External Runtime — OpenRouter + DeepSeek + Mistral OCR

## القرار المعتمد

- مزود النماذج: **OpenRouter**.
- النموذج الأساسي: **DeepSeek V4 Flash** (`deepseek/deepseek-v4-flash`).
- نموذج احتياطي موجود في السجل لكنه متوقف افتراضيًا: **DeepSeek V4 Pro**.
- استخراج الصور وPDF الممسوح: **Mistral OCR 3** (`mistral-ocr-2512`).

تم اختيار هذه الحزمة لأنها تجمع سرعة الاستجابة، كفاءة المهام العربية والتحليلية، انخفاض تكلفة الرموز، التوجيه بين مزودات الاستضافة، واستخراج النص والجداول من المستندات دون إضافة بنية Google Cloud معقدة في النسخة التجريبية.

## حدود الأمان

- لا يُحفظ أي مفتاح في GitHub أو Supabase.
- المفاتيح متغيرات خادم مشفرة داخل Vercel فقط.
- سجلات Supabase تحفظ أسماء المزودات والنماذج والأسعار والسياسات فقط.
- التوجيه يطلب مزودات لا تجمع محتوى العميل ويحتفظ بالـfallback عند الأعطال.
- لا تُفتح بوابتا النموذج وOCR إلا بعد فحص المفاتيح، فحص الصحة، وتجربة توليد فعلية قصيرة.
- القنوات الخارجية والكتابة الخارجية والحذف تبقى مغلقة.

## متغيرات Vercel المطلوبة

```text
ORBY_OPENROUTER_API_KEY=<secret>
ORBY_OPENROUTER_SITE_URL=https://www.orbitmadar.com
ORBY_OPENROUTER_APP_NAME=MADAR | ORBIT
ORBY_OCR_PROVIDER=mistral
ORBY_MISTRAL_OCR_API_KEY=<secret>
ORBY_OCR_MODEL=mistral-ocr-2512
```

اختياريًا:

```text
ORBY_OCR_TIMEOUT_MS=55000
ORBY_OCR_MAX_BYTES=20971520
```

## دورة التفعيل

1. أضف المفاتيح إلى Vercel Production وPreview.
2. أعد نشر آخر إصدار من `main`.
3. سجّل الدخول بحساب المؤسس.
4. افتح `/admin/orby-os/models`.
5. اضغط **فحص المفاتيح وتفعيل التشغيل**.
6. لا تُفتح البوابات إلا عند نجاح OpenRouter وDeepSeek V4 Flash وMistral OCR.

## الإيقاف الفوري

زر **إيقاف التشغيل الخارجي** يعطّل المزود والنماذج وإعداد runtime وبوابتي provider execution وOCR، دون حذف البيانات أو المفاتيح من Vercel.
