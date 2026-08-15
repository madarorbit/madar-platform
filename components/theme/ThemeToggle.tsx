'use client';

import {useTheme} from './ThemeProvider';
import {cx} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';

export default function ThemeToggle({showLabel=false,className}:{showLabel?:boolean;className?:string}){
 const{toggleTheme}=useTheme();
 return <button type="button" onClick={toggleTheme} className={cx('md-theme-toggle',showLabel&&'md-theme-toggle-with-label',className)} aria-label="التبديل بين الوضع الفاتح والوضع الداكن" title="تبديل مظهر المنصة">
  <span className="md-theme-toggle-visual" aria-hidden="true">
   <Icon name="sun" className="md-theme-toggle-icon md-theme-toggle-sun"/>
   <Icon name="moon" className="md-theme-toggle-icon md-theme-toggle-moon"/>
  </span>
  {showLabel&&<span className="md-theme-toggle-copy" aria-hidden="true"><span className="md-theme-label-light">الوضع الفاتح</span><span className="md-theme-label-dark">الوضع الداكن</span></span>}
 </button>;
}
