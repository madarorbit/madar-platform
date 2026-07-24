const replacements:Array<[RegExp,string]> = [
  [/\bGoogle\s+Sheets\b/gi,'جداول جوجل'],
  [/\bGoogle\b/gi,'جوجل'],
  [/\bNotion\b/gi,'نوشن'],
  [/\bAI\b/gi,'الذكاء الاصطناعي'],
  [/\bAutomation\b/gi,'الأتمتة'],
  [/\bBeta\b/gi,'النسخة التجريبية'],
  [/\bPDF\b/gi,'مستند محمول'],
  [/\bCSV\b/gi,'ملف بيانات مفصول'],
  [/\bExcel\b/gi,'إكسل'],
  [/\bWhatsApp\b/gi,'واتساب'],
  [/\bORBY\b/gi,'أوربي'],
  [/\bprompt(s)?\b/gi,'تعليمات ذكية'],
  [/\bminor\b/gi,'طفيفة'],
];

export function arabicDisplay(value:unknown){
  let text=String(value??'');
  for(const[pattern,replacement]of replacements)text=text.replace(pattern,replacement);
  return text;
}

const currencyNames:Record<string,string>={
  SAR:'ريال سعودي',
  YER:'ريال يمني',
  USD:'دولار أمريكي',
  'ر.س':'ريال سعودي',
  'ر.ي':'ريال يمني',
};

export function currencyName(value:unknown){
  const currency=String(value??'').trim();
  return currencyNames[currency]||arabicDisplay(currency);
}

export function arabicMoney(amount:unknown,currency:unknown){
  const numeric=Number(amount||0);
  return `${numeric.toLocaleString('ar-YE')} ${currencyName(currency)}`;
}

export function arabicList(values:unknown){
  return Array.isArray(values)?values.map(arabicDisplay):[];
}
