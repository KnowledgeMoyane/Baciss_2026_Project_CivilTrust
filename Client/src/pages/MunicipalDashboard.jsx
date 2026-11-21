import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Lock, ArrowUp, ChevronRight, FileText, CreditCard, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { API_URL } from '../config/supabase';
import { CHAIN_CONFIG } from '../config/contract';
import { ethers } from 'ethers';

export default function MunicipalDashboard() {
  const navigate = useNavigate();
  const { contract } = useWallet();
  const [stats, setStats] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contract) return;
    loadData();
  }, [contract]);

  async function loadData() {
    setLoading(true);
    try {
      // Fetch on-chain stats
      const raw = await contract.getDashboardStats();
      setStats({
        lockedEscrow: ethers.formatEther(raw.lockedEscrow),
        disbursed: ethers.formatEther(raw.disbursed),
        activeTenders: Number(raw.activeTenders),
        disputedMilestones: Number(raw.disputedMilestones),
        completedTenders: Number(raw.completedTenders),
      });

      // Fetch recent tenders from chain
      const count = await contract.tenderCount();
      const total = Number(count);
      const limit = Math.min(total, 5);
      if (limit > 0) {
        const [page] = await contract.getTendersPaginated(Math.max(total - limit, 0), limit);
        setTenders(page.map(parseTender).reverse());
      }

      // Fetch activity from API
      try {
        const res = await fetch(`${API_URL}/activity?limit=10`);
        const data = await res.json();
        setActivity(data.activity || []);
      } catch { /* API may not have data yet */ }
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }

  function parseTender(t) {
    return {
      id: Number(t.id),
      title: t.title,
      ward: t.ward,
      escrow: ethers.formatEther(t.totalEscrow),
      status: ['Active', 'Completed', 'Cancelled'][Number(t.status)],
      milestones: `${Number(t.currentMilestone)}/${Number(t.totalMilestones)}`,
    };
  }

  return (
    <>
      {/* Title & Publish CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">Johannesburg Metropolitan Infrastructure Escrow Overview</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/create-tender')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-semibold text-sm shadow-lg shadow-cyan-500/25 transition-all transform active:scale-95 duration-150"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Publish New Tender</span>
        </button>
      </div>

      {/* KPI Cards */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <article className="glass-card rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Locked Escrow</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              {loading ? '...' : (stats?.lockedEscrow || '0')}
            </span>
            <span className="text-sm font-semibold text-cyan-400 font-mono">ETH</span>
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Disbursed</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              {loading ? '...' : (stats?.disbursed || '0')}
            </span>
            <span className="text-sm font-semibold text-cyan-400 font-mono">ETH</span>
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Tenders</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
          </div>
          <div>
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              {loading ? '...' : (stats?.activeTenders ?? 0)}
            </span>
          </div>
        </article>

        <article className="glass-card rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Disputed Milestones</span>
          </div>
          <div>
            <span className="text-2xl lg:text-3xl font-bold tracking-tight text-white">
              {loading ? '...' : (stats?.disputedMilestones ?? 0)}
            </span>
          </div>
        </article>
      </section>

      {/* Main Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Activity Feed */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-6 shadow-md border border-slate-800/80">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Recent On-Chain Activity Feed</h2>
              <p className="text-xs text-slate-400">Real-time audited smart contract transactions</p>
            </div>
          </div>

          <div className="divide-y divide-slate-800/60">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading activity...</p>
              </div>
            ) : activity.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                <Lock className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p>No on-chain transactions yet.</p>
                <p className="text-xs mt-1">Transactions will appear here once tenders are published and funded.</p>
              </div>
            ) : (
              activity.map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{a.summary}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  {a.chain_tx_hash && (
                    <a
                      href={`${CHAIN_CONFIG.blockExplorer}/tx/${a.chain_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 ml-3 flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Actions */}
          <div className="glass-card rounded-2xl p-4 shadow-md">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Quick Actions</h3>
              <p className="text-[11px] text-slate-400">Escrow and ledger tasks</p>
            </div>
            <div className="divide-y divide-slate-800/60 mt-1">
              {[
                { label: 'Create Tender', icon: Plus, href: '/create-tender' },
                { label: 'Active Tenders', icon: FileText, href: '/tenders' },
                { label: 'Disputed Milestones', icon: XCircle, href: '/tenders', rose: true },
              ].map(({ label, icon: Icon, href, rose }) => (
                <button
                  key={label}
                  onClick={() => navigate(href)}
                  className={`w-full py-2 flex items-center justify-between group ${rose ? 'hover:text-rose-400' : 'hover:text-cyan-400'} transition-colors`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${rose ? 'text-rose-400' : 'text-slate-400 group-hover:text-cyan-400'}`} />
                    <span className={`text-xs font-medium text-slate-200 ${rose ? 'group-hover:text-rose-400' : 'group-hover:text-cyan-400'}`}>{label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-all`} />
                </button>
              ))}
            </div>
          </div>

          {/* Active Tenders List */}
          <div className="glass-card rounded-2xl p-5 shadow-md border border-slate-800/80">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Active Tenders Overview</h3>
                <p className="text-[11px] text-slate-400">Recent municipal contracts</p>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {stats?.activeTenders ?? '--'} Live
              </span>
            </div>
            <div className="space-y-2 mt-2">
              {loading ? (
                <div className="py-6 text-center">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
                </div>
              ) : tenders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-sm">
                  <FileText className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs">No active tenders yet.</p>
                </div>
              ) : (
                tenders.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800/60 hover:border-cyan-500/20 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{t.title}</p>
                      <p className="text-[10px] text-slate-500">{t.ward} &bull; Milestone {t.milestones}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-xs font-mono font-semibold text-cyan-400">{t.escrow} ETH</p>
                      <span className={`text-[10px] font-medium ${
                        t.status === 'Active' ? 'text-emerald-400' : t.status === 'Completed' ? 'text-cyan-400' : 'text-red-400'
                      }`}>{t.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
