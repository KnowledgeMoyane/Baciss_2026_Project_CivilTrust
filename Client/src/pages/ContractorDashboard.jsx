import { useEffect, useState } from 'react';
import { X, Sparkles, Lock, ExternalLink, Check, Loader2, Brain } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { CHAIN_CONFIG } from '../config/contract';
import { ethers } from 'ethers';

export default function ContractorDashboard() {
  const { contract, account } = useWallet();
  const [activeFilter, setActiveFilter] = useState('my');
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTender, setSelectedTender] = useState(null);
  const [milestones, setMilestones] = useState([]);

  const filters = [
    { key: 'my', label: 'My Tenders' },
    { key: 'progress', label: 'In Progress' },
    { key: 'awaiting', label: 'Awaiting AI & Vote' },
    { key: 'paid', label: 'Released/Paid' },
  ];

  useEffect(() => { if (contract && account) loadTenders(); }, [contract, account]);

  async function loadTenders() {
    setLoading(true);
    try {
      const ids = await contract.getContractorTenderIds(account);
      const results = await Promise.all(ids.map(id => contract.getTender(id)));
      setTenders(results.map(parseTender).reverse());
    } catch (err) {
      console.error('Load contractor tenders failed:', err);
    } finally {
      setLoading(false);
    }
  }

  function parseTender(t) {
    const statusMap = ['Active', 'Completed', 'Cancelled'];
    return {
      id: Number(t.id),
      title: t.title,
      ward: t.ward,
      escrow: ethers.formatEther(t.totalEscrow),
      released: ethers.formatEther(t.releasedAmount),
      status: statusMap[Number(t.status)],
      totalMilestones: Number(t.totalMilestones),
      currentMilestone: Number(t.currentMilestone),
      baselinePhotoIPFS: t.baselinePhotoIPFS,
    };
  }

  async function selectTender(t) {
    setSelectedTender(t);
    try {
      const ms = await contract.getAllMilestones(t.id);
      const milestoneStatusMap = ['Funded', 'AwaitingVote', 'Disputed', 'Released'];
      setMilestones(ms.map((m, i) => ({
        index: i,
        amount: ethers.formatEther(m.amount),
        description: m.description,
        aiScore: Number(m.aiScore),
        aiStructural: Number(m.aiStructural),
        aiMaterials: Number(m.aiMaterials),
        aiCompletion: Number(m.aiCompletion),
        status: milestoneStatusMap[Number(m.status)],
        approvals: Number(m.approvalsCount),
        rejections: Number(m.rejectionsCount),
        releasedAt: Number(m.releasedAt),
      })));
    } catch (err) {
      console.error('Load milestones failed:', err);
    }
  }

  const filtered = tenders.filter(t => {
    if (activeFilter === 'my') return true;
    if (activeFilter === 'progress') return t.status === 'Active';
    if (activeFilter === 'paid') return t.status === 'Completed';
    if (activeFilter === 'awaiting') return t.status === 'Active';
    return true;
  });

  const currentMs = milestones[selectedTender?.currentMilestone];

  return (
    <div className="flex-1 flex overflow-hidden -m-8 -mb-6">
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-white">Contractor Dashboard</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">Escrow Linked</span>
          </div>
          <p className="text-sm text-slate-400">Track assigned tenders, review audit reports, and view payouts.</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800/80 pb-4">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition ${
                activeFilter === f.key ? 'font-semibold bg-slate-800 text-cyan-300 border border-cyan-800/40 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}>{f.label}</button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#0b1120] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-900/60">
                <th className="py-3 px-4">Tender Title</th>
                <th className="py-3 px-4">Escrow (ETH)</th>
                <th className="py-3 px-4">Released (ETH)</th>
                <th className="py-3 px-4">Milestone</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-sm">
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading your tenders...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-500">
                  <Lock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm">No assigned tenders yet.</p>
                  <p className="text-xs text-slate-600">Tenders assigned to your wallet will appear here.</p>
                </td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-200">{t.title}</p>
                      <p className="text-[10px] text-slate-500">{t.ward}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400 text-xs">{t.escrow}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400 text-xs">{t.released}</td>
                    <td className="py-3 px-4 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(t.currentMilestone / t.totalMilestones) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[10px]">{t.currentMilestone}/{t.totalMilestones}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => selectTender(t)} className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Drawer */}
      {selectedTender && (
        <aside className="w-[430px] flex-shrink-0 bg-[#0c1322] border-l border-slate-800 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">{selectedTender.title}</h3>
                <p className="text-xs text-slate-400">{selectedTender.ward}</p>
              </div>
              <button onClick={() => setSelectedTender(null)} className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/80">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Milestone Pipeline */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Milestone Pipeline</h4>
              {milestones.map((m) => (
                <div key={m.index} className={`p-3 rounded-lg border ${
                  m.index === selectedTender.currentMilestone ? 'border-cyan-500/30 bg-cyan-950/20' : 'border-slate-800 bg-slate-950'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200">{m.index + 1}. {m.description || 'Milestone'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      m.status === 'Released' ? 'bg-emerald-500/10 text-emerald-400' :
                      m.status === 'AwaitingVote' ? 'bg-amber-500/10 text-amber-400' :
                      m.status === 'Disputed' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'
                    }`}>{m.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono">{m.amount} ETH</span>
                    {m.aiScore > 0 && <span>AI: {m.aiScore}% | Votes: {m.approvals}/3</span>}
                    {m.releasedAt > 0 && <span className="text-emerald-400">Paid {new Date(m.releasedAt * 1000).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Report for current milestone */}
            {currentMs && currentMs.aiScore > 0 && (
              <div className="mt-5 p-4 rounded-xl bg-slate-900/70 border border-slate-800/90">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase">Current Milestone AI Report</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Overall', val: currentMs.aiScore },
                    { label: 'Structural', val: currentMs.aiStructural },
                    { label: 'Materials', val: currentMs.aiMaterials },
                    { label: 'Completion', val: currentMs.aiCompletion },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-slate-950 p-2">
                      <p className="text-[9px] text-slate-400 uppercase">{s.label}</p>
                      <p className={`text-base font-bold font-mono ${s.val >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{s.val}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payout Checklist */}
            <div className="mt-5">
              <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Payout Requirements</h5>
              <div className="space-y-2">
                {[
                  { label: 'Site photo uploaded', done: currentMs?.aiScore > 0 },
                  { label: 'AI passed (Score >= 75%)', done: currentMs?.aiScore >= 75 },
                  { label: `Ward Vote (${currentMs?.approvals || 0} of 3 Approve)`, done: currentMs?.approvals >= 3 },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs">
                    <div className={`w-4 h-4 rounded flex items-center justify-center ${done ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-800/50 border border-slate-600'}`}>
                      {done && <Check className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <span className={done ? 'text-emerald-400' : 'text-slate-400'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
