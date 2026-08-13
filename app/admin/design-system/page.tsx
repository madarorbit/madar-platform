import type {Metadata} from 'next';
import DesignSystemShowcase from '@/components/admin/DesignSystemShowcase';

export const metadata:Metadata={title:'MADAR Design System 2.0'};

export default function DesignSystemPage(){
 return <main className="md-page-container md-page md-ds-catalog">
  <header className="md-account-page-header"><div><span className="md-eyebrow">مرجع إداري محمي</span><h1 className="md-type-h1 mt-3">MADAR Design System 2.0</h1><p>كتالوج تنفيذي للرموز والمكوّنات والحالات المعتمدة. هذا المسار محمي بنفس بوابة إدارة مَدار.</p></div></header>
  <DesignSystemShowcase/>
 </main>;
}
