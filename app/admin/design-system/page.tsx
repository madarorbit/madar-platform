import type {Metadata} from 'next';
import DesignSystemShowcase from '@/components/admin/DesignSystemShowcase';
import DashboardDesignSystemShowcase from '@/components/admin/DashboardDesignSystemShowcase';
import DataVisualizationSystemShowcase from '@/components/admin/DataVisualizationSystemShowcase';

export const metadata:Metadata={title:'MADAR Design System 2.0'};

export default function DesignSystemPage(){
 return <main className="md-page-container md-page md-ds-catalog">
  <header className="md-account-page-header"><div><span className="md-eyebrow">مرجع إداري محمي</span><h1 className="md-type-h1 mt-3">MADAR Design System 2.0</h1><p>كتالوج تنفيذي للرموز والمكوّنات والحالات المعتمدة. هذا المسار محمي بنفس بوابة إدارة مَدار.</p></div></header>
  <DesignSystemShowcase/>
  <div className="mt-12 border-t border-[var(--md-border-subtle)] pt-10">
   <header className="mb-8"><span className="md-eyebrow">Dashboard Shared Layer</span><h2 className="md-type-h1 mt-3">نظام تصميم الداشبورد</h2><p className="md-muted mt-2 max-w-3xl">كتالوج Phase 2.0 للمكوّنات المشتركة المحايدة تجاه الخدمات، ببيانات UI توضيحية فقط.</p></header>
   <DashboardDesignSystemShowcase/>
  </div>
  <div className="mt-12 border-t border-[var(--md-border-subtle)] pt-10">
   <header className="mb-8"><span className="md-eyebrow">نظام تصور البيانات — Phase 3.0</span><h2 className="md-type-h1 mt-3">لغة الرسوم وتصور البيانات</h2><p className="md-muted mt-2 max-w-3xl">مرجع عربي أولًا يشرح السؤال الذي يجيب عنه كل تمثيل، وحدود استخدامه، وحالات البيانات والثقة دون ربطه بأي خدمة.</p></header>
   <DataVisualizationSystemShowcase/>
  </div>
 </main>;
}
