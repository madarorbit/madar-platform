import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const root=new URL('../',import.meta.url);
const read=(file)=>readFile(new URL(file,root),'utf8');

async function walk(relative){
 const absolute=new URL(`${relative}/`,root);
 const entries=await readdir(absolute,{withFileTypes:true});
 const files=[];
 for(const entry of entries){
  const next=path.posix.join(relative,entry.name);
  if(entry.isDirectory()) files.push(...await walk(next));
  else if(/\.(?:ts|tsx)$/.test(entry.name)) files.push(next);
 }
 return files;
}

test('recharts is pinned with matching react-is and lockfile state',async()=>{
 const [pkg,lock]=await Promise.all([read('package.json'),read('package-lock.json')]);
 const parsed=JSON.parse(pkg);
 assert.equal(parsed.dependencies.recharts,'3.10.1');
 assert.equal(parsed.dependencies['react-is'],'19.2.4');
 assert.match(lock,/"node_modules\/recharts"[\s\S]*"version": "3\.10\.1"/);
 assert.match(lock,/"node_modules\/react-is"[\s\S]*"version": "19\.2\.4"/);
});

test('recharts stays hidden behind MADAR visualization layer',async()=>{
 const roots=['app','components','lib'];
 const files=(await Promise.all(roots.map(async(dir)=>{try{return await walk(dir)}catch{return []}}))).flat();
 const offenders=[];
 for(const file of files){
  const source=await read(file);
  if(/from ["']recharts["']/.test(source)&&!file.startsWith('components/dashboard/visualization/')) offenders.push(file);
 }
 assert.deepEqual(offenders,[]);
});

test('core vocabulary is service neutral and data-in UI-out',async()=>{
 const source=await read('components/dashboard/visualization/charts.tsx');
 for(const name of ['TrendChart','CategoryBarChart','StackedBarChart','CompositionDonut','TargetProgress','Sparkline']){
  assert.match(source,new RegExp(`export function ${name}`));
 }
 for(const forbidden of ['RetailSalesChart','ConnectedSyncChart','NativeOrdersChart','supabase','organization_id','rpc(','fetch(']){
  assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
 }
});

test('series identity is separate from business outcome and numeric direction',async()=>{
 const [types,shared,charts,css]=await Promise.all([
  read('components/dashboard/visualization/types.ts'),
  read('components/dashboard/visualization/shared.tsx'),
  read('components/dashboard/visualization/charts.tsx'),
  read('app/dashboard-visualization-3.css'),
 ]);
 assert.match(types,/VisualizationOutcome = "favorable" \| "unfavorable" \| "neutral" \| "unknown"/);
 assert.match(types,/VisualizationSeriesToken/);
 assert.match(shared,/--md-viz-series-1/);
 assert.equal(/chart-positive|chart-negative|positiveMetric|negativeMetric/i.test(`${shared}\n${charts}\n${css}`),false);
 assert.equal(/value\s*[><]=?\s*0[\s\S]{0,40}(favorable|unfavorable)/i.test(charts),false);
});

test('legacy positive negative tokens remain compatibility only and are documented deprecated',async()=>{
 const [baseTokens,newTokens,doc]=await Promise.all([
  read('app/design-tokens.css'),
  read('app/dashboard-visualization-tokens-3.css'),
  read('docs/MADAR_DATA_VISUALIZATION_SYSTEM_3.md'),
 ]);
 assert.match(baseTokens,/--md-chart-positive/);
 assert.match(baseTokens,/--md-chart-negative/);
 assert.equal(/chart-positive|chart-negative/.test(newTokens),false);
 assert.match(doc,/Legacy \/ deprecated for generic metric direction/);
});

test('missing data remains missing and partial stale integrate with phase 2',async()=>{
 const [charts,showcase,doc]=await Promise.all([
  read('components/dashboard/visualization/charts.tsx'),
  read('components/admin/DataVisualizationSystemShowcase.tsx'),
  read('docs/MADAR_DATA_VISUALIZATION_SYSTEM_3.md'),
 ]);
 assert.ok((charts.match(/connectNulls=\{false\}/g)||[]).length>=2);
 assert.match(charts,/partialRange/);
 assert.match(charts,/DashboardEmptyState/);
 assert.match(showcase,/state="partial"/);
 assert.match(showcase,/state="stale"/);
 assert.match(doc,/Missing ≠ Zero/);
});

test('donut has an encoded small-category limit and recommends bar when exceeded',async()=>{
 const [charts,doc]=await Promise.all([read('components/dashboard/visualization/charts.tsx'),read('docs/MADAR_DATA_VISUALIZATION_SYSTEM_3.md')]);
 assert.match(charts,/MAX_DONUT_SLICES = 5/);
 assert.match(charts,/استخدم Bar/);
 assert.match(doc,/MAX_DONUT_SLICES = 5/);
});

test('Arabic RTL tooltip legend and numeric isolation are first-class contracts',async()=>{
 const [shared,showcase]=await Promise.all([
  read('components/dashboard/visualization/shared.tsx'),
  read('components/admin/DataVisualizationSystemShowcase.tsx'),
 ]);
 assert.match(shared,/dir="rtl"/);
 assert.match(shared,/aria-label="مفتاح سلاسل الرسم"/);
 assert.match(shared,/role="status" aria-live="polite"/);
 assert.match(shared,/<bdi[^>]*dir="ltr"/);
 for(const heading of ['الاتجاه عبر الزمن','مقارنة الفئات','أجزاء قليلة من إجمالي','التقدم نحو هدف']) assert.ok(showcase.includes(heading),heading);
});

test('visualization CSS is semantic responsive and reduced-motion aware',async()=>{
 const [css,tokens]=await Promise.all([read('app/dashboard-visualization-3.css'),read('app/dashboard-visualization-tokens-3.css')]);
 assert.equal(/#[0-9a-f]{3,8}\b/i.test(css),false,'raw palette belongs in visualization token file only');
 for(const token of ['var(--md-surface-overlay)','var(--md-chart-grid)','var(--md-viz-series-1)','var(--md-viz-target)']) assert.ok(`${css}\n${tokens}`.includes(token),token);
 assert.match(css,/@media \(max-width: 639px\)/);
 assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
});

test('mobile behavior is a recomposition rather than horizontal scrolling',async()=>{
 const [charts,css]=await Promise.all([read('components/dashboard/visualization/charts.tsx'),read('app/dashboard-visualization-3.css')]);
 assert.match(charts,/useMobileVisualization/);
 assert.match(charts,/orientation === "auto"/);
 assert.match(charts,/maxLabelLength > 14/);
 assert.match(charts,/ArabicCategoryTick/);
 assert.equal(/overflow-x:\s*auto/.test(css),false);
});

test('motion and accessibility do not rely on Recharts defaults alone',async()=>{
 const [charts,shared]=await Promise.all([read('components/dashboard/visualization/charts.tsx'),read('components/dashboard/visualization/shared.tsx')]);
 assert.match(charts,/accessibilityLayer/);
 assert.match(charts,/isAnimationActive: !reducedMotion/);
 assert.match(charts,/isAnimationActive=\{!reducedMotion\}/);
 assert.match(shared,/prefers-reduced-motion: reduce/);
 assert.match(shared,/ملخص نصي للبيانات/);
});

test('showcase teaches question-first selection with required vocabulary',async()=>{
 const showcase=await read('components/admin/DataVisualizationSystemShowcase.tsx');
 assert.match(showcase,/بيانات توضيحية للواجهة فقط/);
 assert.ok((showcase.match(/السؤال:/g)||[]).length>=6);
 for(const component of ['TrendChart','CategoryBarChart','StackedBarChart','CompositionDonut','TargetProgress','Sparkline']) assert.ok(showcase.includes(component),component);
 assert.equal(/getAnalyticsSnapshot|supabaseFetch|business_analytics|retail_analytics/i.test(showcase),false);
});

test('phase 3 documentation preserves question-first and phase 4 boundaries',async()=>{
 const doc=await read('docs/MADAR_DATA_VISUALIZATION_SYSTEM_3.md');
 for(const section of [
  'Question → Data → Visualization','Recharts 3.10.1','TrendChart','CategoryBarChart','StackedBarChart','CompositionDonut','TargetProgress','Sparkline',
  'Series Identity ≠ Business Outcome','Tooltip','Legend','Axes','Missing Data','Accessibility','RTL / Arabic-first','Responsive / Mobile','Phase 4.0 boundary'
 ]) assert.ok(doc.includes(section),section);
 assert.match(doc,/لا تنفذ aggregation/);
});
