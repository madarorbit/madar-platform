import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
export default function PageShell({ children }: { children: React.ReactNode }) { return <><Navbar/><main className="min-h-screen bg-[#0B1020] text-white">{children}</main><Footer/></>; }
