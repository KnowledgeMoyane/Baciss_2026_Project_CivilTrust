import { Search, ChevronDown, User } from 'lucide-react';

export default function TopHeader({ userName = '', role = '', compact = false }) {
  return (
    <header className={`sticky top-0 z-30 ${compact ? 'h-16' : 'h-20'} px-8 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 flex items-center justify-between gap-4`}>
      {/* Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </div>
          <input
            type="search"
            placeholder="Search tenders, tx hash, address..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800/90 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500 transition-all font-sans"
          />
        </div>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-4">
        {userName && (
          <button type="button" className="flex items-center gap-3 px-3 py-1.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800 transition-all group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 p-[1.5px] shadow-sm">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                <User className="w-4 h-4 text-cyan-300" />
              </div>
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-sm font-semibold text-slate-200 leading-none group-hover:text-white">{userName}</div>
              <div className="text-[10px] text-cyan-400 font-mono mt-0.5">{role}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
          </button>
        )}
      </div>
    </header>
  );
}
