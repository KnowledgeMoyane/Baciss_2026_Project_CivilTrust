import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  ShieldCheck,
  Users,
  ScanLine,
  UserCheck,
  LogOut,
} from 'lucide-react';
import useWallet from '../hooks/useWallet';

const navSets = {
  municipal: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/create-tender', label: 'Create Tender', icon: FilePlus },
    { to: '/tenders', label: 'Active Tenders', icon: FileText },
  ],
  contractor: [
    { to: '/contractor', label: 'My Tenders', icon: Users },
  ],
  ward: [
    { to: '/ward-committee', label: 'Vote & Sign-Off', icon: UserCheck },
  ],
  citizen: [
    { to: '/citizen', label: 'Area Scanner', icon: ScanLine },
  ],
};

const authenticatedRoles = ['municipal', 'contractor', 'ward'];

export default function Sidebar({ variant = 'municipal' }) {
  const links = navSets[variant] || navSets.municipal;
  const navigate = useNavigate();
  const { disconnectWallet } = useWallet();
  const requiresAuth = authenticatedRoles.includes(variant);

  const handleLogout = () => {
    disconnectWallet();
    navigate('/login');
  };

  return (
    <aside className="relative z-20 w-64 shrink-0 bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-xl flex flex-col justify-between h-screen">
      <div className="flex flex-col">
        {/* Brand */}
        <div className="h-20 px-6 flex items-center gap-3 border-b border-slate-800/60">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-indigo-500 p-[2px] shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white flex items-center">
              Civic<span className="text-cyan-400">Trust</span>
            </span>
            <span className="text-[10px] tracking-widest uppercase font-mono text-slate-400 -mt-1">
              Municipal Ledger
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav aria-label="Main Navigation" className="p-4 space-y-1.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive
                  ? 'flex items-center justify-between gap-3.5 px-3.5 py-3 rounded-xl bg-gradient-to-r from-cyan-500/15 via-teal-500/10 to-transparent text-cyan-400 font-medium border-l-4 border-cyan-400 shadow-sm transition-all'
                  : 'flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition-colors group'
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3.5">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-400 transition-colors'}`} />
                    <span className={`text-sm tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3 mx-3 mb-3">
        {/* Logout Button — only for wallet-authenticated roles */}
        {requiresAuth && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all group"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors" />
            <span className="text-sm font-medium tracking-wide">Disconnect Wallet</span>
          </button>
        )}

        {/* Avalanche Subnet Status */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold text-slate-300">Avalanche Subnet</span>
        </div>
        <p className="text-[11px] text-slate-400 font-mono">Sync: Block #19,482,109</p>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
          <div className="bg-cyan-500 h-full rounded-full w-full" />
        </div>
        </div>
      </div>
    </aside>
  );
}
