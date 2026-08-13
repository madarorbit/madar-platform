import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
export default function PageShell({children}:{children:React.ReactNode}){return <div className="md-public-page-frame"><a href="#main-content" className="md-skip-link">تجاوز إلى المحتوى</a><Navbar/><main id="main-content" className="md-shell md-public-shell" tabIndex={-1}>{children}</main><Footer/></div>}
