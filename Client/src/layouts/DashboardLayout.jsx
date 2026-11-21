import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopHeader from '../components/TopHeader';
import Footer from '../components/Footer';

export default function DashboardLayout({ sidebarVariant = 'municipal', userName = '', role = '', compact = false, bgImage = null }) {
  return (
    <div className="bg-slate-950 text-slate-100 font-sans antialiased min-h-screen selection:bg-cyan-500 selection:text-white flex overflow-hidden">
      {/* Ambient Background */}
      {bgImage && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            alt="Civic Infrastructure Background"
            className="w-full h-full object-cover object-center opacity-10 filter blur-[3px] scale-105 transform"
            src={bgImage}
          />
          <div className="absolute inset-0 dashboard-bg-overlay" />
        </div>
      )}

      <Sidebar variant={sidebarVariant} />

      <div className="flex-1 flex flex-col h-screen overflow-y-auto relative z-10">
        <TopHeader userName={userName} role={role} compact={compact} />
        <main className="flex-1 p-8 space-y-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
