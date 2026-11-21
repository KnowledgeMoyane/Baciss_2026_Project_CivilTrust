import { useEffect, useState } from 'react';
import { ArrowLeft, X, Sparkles, UserCog, AlertCircle, Loader2, ExternalLink, Image, Brain } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { CHAIN_CONFIG } from '../config/contract';
import { ethers } from 'ethers';

export default function ActiveTenders() {
  const { contract, signedContract } = useWallet();
  const [activeFilter, setActiveFilter] = useState('all');
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTender, setSelectedTender] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [reassigning, setReassigning] = useState(false);
  const [newContractor, setNewContractor] = useState('');

  const filters = [
    { key: 'all', label: 'All Tenders' },
    { key: 'active', label: 'Active' },
    { key: 'disputed', label: 'Disputed' },
    { key: 'completed', label: 'Completed' },
  ];

  useEffect(() => { if (contract) loadTenders(); }, [contract]);

  async function loadTenders() {
    setLoading(true);
    try {
      const count = Number(await contract.tenderCount());
      if (count === 0) { setTenders([]); return; }
      const [page] = await contract.getTendersPaginated(0, count);
      setTenders(page.map(parseTender).reverse());
    } catch (err) {
      console.error('Load tenders failed:', err);
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
      contractor: t.contractor,
      escrow: ethers.formatEther(t.totalEscrow),
      released: ethers.formatEther(t.releasedAmount),
      status: statusMap[Number(t.status)],
      statusNum: Number(t.status),
      totalMilestones: Number(t.totalMilestones),
      currentMilestone: Number(t.currentMilestone),
      wardReps: t.wardReps,
      baselinePhotoIPFS: t.baselinePhotoIPFS,
      createdAt: Number(t.createdAt),
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
      })));
    } catch (err) {
      console.error('Load milestones failed:', err);
    }
  }

  async function handleReassign() {
    if (!signedContract || !selectedTender || !newContractor) return;
    setReassigning(true);
    try {
      const tx = await signedContract.reassignContractor(selectedTender.id, newContractor);
      await tx.wait();
      setNewContractor('');
      await loadTenders();
      setSelectedTender(null);
    } catch (err) {
      console.error('Reassign failed:', err);
      alert(err.reason || err.message);
    } finally {
      setReassigning(false);
    }
  }

  async function handleReInspect() {
    if (!signedContract || !selectedTender) return;
    try {
      const tx = await signedContract.reInspectMilestone(selectedTender.id);
      await tx.wait();
      await loadTenders();
      await selectTender({ ...selectedTender });
    } catch (err) {
      alert(err.reason || err.message);
    }
  }

  const filtered = tenders.filter(t => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'active') return t.status === 'Active';
    if (activeFilter === 'disputed') return t.status === 'Active'; // filter further below with milestone
    if (activeFilter === 'completed') return t.status === 'Completed';
    return true;
  });

  const currentMilestone = milestones[selectedTender?.currentMilestone];

  return (
    <div className="flex-1 flex overflow-hidden -m-8 -mb-6">
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Active Tenders &amp; Dispute Manager</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Sepolia</span>
          </div>
          <p className="text-sm text-slate-400">Live tender data from the CivicTrust smart contract.</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 pt-1 border-b border-[#1e293b] pb-4">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === f.key ? 'bg-[#1e293b] text-cyan-400 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]'
              }`}>{f.label}</button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#1e293b] bg-[#0b1120]/70 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-5">Tender Title</th>
                <th className="py-3.5 px-4">Ward</th>
                <th className="py-3.5 px-4 font-mono">Locked ETH</th>
                <th className="py-3.5 px-4 text-center">Milestone</th>
                <th className="py-3.5 px-5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/70">
              {loading ? (
                <tr><td colSpan={5} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading from blockchain...</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-slate-500">
                  <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm">No tenders found.</p>
                </td></tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} onClick={() => selectTender(t)}
                    className="hover:bg-[#131d33] cursor-pointer transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-slate-200">{t.title}</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {t.id}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 text-xs">{t.ward}</td>
                    <td className="py-3.5 px-4 font-mono text-cyan-400 font-semibold text-xs">{t.escrow}</td>
                    <td className="py-3.5 px-4 text-center text-xs text-slate-300">{t.currentMilestone + 1}/{t.totalMilestones}</td>
                    <td className="py-3.5 px-5 text-right">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                        t.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                        t.status === 'Completed' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-red-500/10 text-red-400'
                      }`}>{t.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Audit Drawer */}
      {selectedTender && (
        <aside className="w-[430px] bg-[#0f172a]/95 backdrop-blur-xl border-l border-[#1e293b] flex flex-col shrink-0 z-30 shadow-2xl overflow-y-auto">
          <div className="h-16 px-6 border-b border-[#1e293b] flex items-center justify-between shrink-0 bg-[#080c16]/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedTender(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold text-white">Tender #{selectedTender.id}</h2>
            </div>
            <button onClick={() => setSelectedTender(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5 flex-1">
            <div>
              <p className="text-lg font-bold text-white">{selectedTender.title}</p>
              <p className="text-xs text-slate-400 mt-1">{selectedTender.ward}</p>
              <p className="text-[10px] font-mono text-slate-500 mt-1">Contractor: {selectedTender.contractor}</p>
            </div>

            {/* Milestones */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Milestones</h3>
              {milestones.map((m) => (
                <div key={m.index} className={`p-3 rounded-lg border text-xs ${
                  m.index === selectedTender.currentMilestone ? 'bg-cyan-950/30 border-cyan-500/30' : 'bg-slate-950 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-200">{m.index + 1}. {m.description || 'Milestone'}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      m.status === 'Released' ? 'bg-emerald-500/10 text-emerald-400' :
                      m.status === 'AwaitingVote' ? 'bg-amber-500/10 text-amber-400' :
                      m.status === 'Disputed' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'
                    }`}>{m.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-mono">{m.amount} ETH</span>
                    {m.aiScore > 0 && <span className="font-mono">AI: {m.aiScore}%</span>}
                    {m.approvals > 0 && <span>Votes: {m.approvals}/3</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Current Milestone AI Details */}
            {currentMilestone && currentMilestone.aiScore > 0 && (
              <div className="rounded-xl bg-[#0a0f1d] border border-cyan-500/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase">AI Audit Score</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'Overall', val: currentMilestone.aiScore },
                    { label: 'Structural', val: currentMilestone.aiStructural },
                    { label: 'Materials', val: currentMilestone.aiMaterials },
                    { label: 'Completion', val: currentMilestone.aiCompletion },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-slate-900 p-2">
                      <p className="text-[9px] text-slate-400 uppercase">{s.label}</p>
                      <p className={`text-lg font-bold font-mono ${s.val >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{s.val}%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions for Disputed */}
            {currentMilestone?.status === 'Disputed' && (
              <div className="space-y-3 pt-2">
                <button onClick={handleReInspect}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0b1120] hover:bg-[#131d33] text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition-colors">
                  Request Re-inspection
                </button>
                <div className="space-y-2">
                  <input type="text" value={newContractor} onChange={e => setNewContractor(e.target.value)}
                    placeholder="New contractor 0x..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-slate-800" />
                  <button onClick={handleReassign} disabled={reassigning || !newContractor}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-semibold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <UserCog className="w-4 h-4" />
                    {reassigning ? 'Reassigning...' : 'Re-Assign Contractor'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
