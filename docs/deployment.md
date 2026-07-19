# النشر

استخدم استضافة متوافقة مع Next.js server runtime عند تفعيل المصادقة والطلبات. جهز PostgreSQL مُداراً وobject storage خاصاً ومزود بريد، ثم اضبط الأسرار في لوحة الاستضافة، وشغّل migrations وseed bootstrap مرة واحدة. فعّل HTTPS والمراقبة وسجلات الأخطاء وhealth check وخطة rollback إلى الإصدار السابق. Netlify صالح فقط بعد التحقق من دعم runtime والحدود المطلوبة.
