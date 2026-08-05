import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
export default function PageShell({children}:{children:React.ReactNode}){return <div className="md-public-page-frame"><Navbar/><main className="md-shell md-public-shell">{children}</main><Footer/></div>}
