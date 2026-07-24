'use client';

import {useTheme} from './ThemeProvider';
import {cx} from '@/components/ui/Enterprise';

export default function ThemeToggle({showLabel=false,className}:{showLabel?:boolean;className?:string}){
 const{toggleTheme}=useTheme();
 return <button type="button" onClick={toggleTheme} className={cx('md-theme-toggle',showLabel&&'md-theme-toggle-with-label',className)} aria-label="التبديل بين الوضع الفاتح والوضع الداكن" title="تبديل مظهر المنصة">
  <span className="md-theme-toggle-visual" aria-hidden="true">
   <svg className="md-theme-toggle-icon md-theme-toggle-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2.1M12 19.4v2.1M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2.1M19.4 12h2.1M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5"/></svg>
   <svg className="md-theme-toggle-icon md-theme-toggle-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.2 15.2A8.2 8.2 0 0 1 8.8 3.8 8.3 8.3 0 1 0 20.2 15.2Z"/></svg>
  </span>
  {showLabel&&<span className="md-theme-toggle-copy" aria-hidden="true"><span className="md-theme-label-light">الوضع الفاتح</span><span className="md-theme-label-dark">الوضع الداكن</span></span>}
 </button>;
}
