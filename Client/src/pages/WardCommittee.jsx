import { useEffect, useState } from 'react';
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, Image, Brain, ExternalLink,
  ChevronDown, ChevronUp, AlertTriangle, Vote, Users, MapPin, FileText, Loader2,
} from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { CHAIN_CONFIG } from '../config/contract';
import { ethers } from 'ethers';

export default function WardCommittee() {
  const { contract, signedContract, account, shortAddress } = useWallet();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTender, setExpandedTender] = useState(null);
  const [votingTenderId, setVotingTenderId] = useState(null);
  const [voteType, setVoteType] = useState(null);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, released: 0 });

  useEffect(() => { if (contract && account) loadData(); }, [contract, account]);

  async function loadData() {
    setLoading(true);
    try {
      const ids = await contract.getWardRepTenderIds(account);
      const results = [];

      for (const id of ids) {
        const t = await contract.getTender(id);
        const ms = await contract.getAllMilestones(id);
        const currentMs = ms[Number(t.currentMilestone)];
        const msStatus = Number(currentMs.status);

        // Get vote status for current milestone
        const voteData = await contract.getMilestoneVoteStatus(id, Number(t.currentMilestone));
        const reps = t.wardReps;
        const roles = ['Chairperson', 'Community Engineer', 'Civic Auditor'];

        const voters = reps.map((addr, i) => ({
          wallet: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
          fullAddress: addr,
          role: roles[i],
          voted: voteData.voted[i],
          approved: voteData.choices[i],
        }));

        const myVote = voters.find(v => v.fullAddress.toLowerCase() === account.toLowerCase());

        results.push({
          id: Number(t.id),
          title: t.title,
          ward: t.ward,
          contractor: `${t.contractor.slice(0, 6)}...${t.contractor.slice(-4)}`,
          status: Number(t.status),
          milestoneStatus: msStatus,
          aiScore: Number(currentMs.aiScore),
          aiStructural: Number(currentMs.aiStructural),
          aiMaterials: Number(currentMs.aiMaterials),
          aiCompletion: Number(currentMs.aiCompletion),
          votesApproved: Number(currentMs.approvalsCount),
          votesRejected: Number(currentMs.rejectionsCount),
          voters,
          hasVoted: myVote?.voted || false,
          myApproved: myVote?.approved || false,
          currentMilestone: Number(t.currentMilestone),
          totalMilestones: Number(t.totalMilestones),
          escrow: ethers.formatEther(t.totalEscrow),
          baselinePhotoIPFS: t.baselinePhotoIPFS,
          afterPhotoIPFS: currentMs.afterPhotoIPFS,
          aiReportIPFS: currentMs.aiReportIPFS,
          citizenNotes: currentMs.citizenNotes,
        });
      }

      setTenders(results);

      // Calculate stats
      let pending = 0, approved = 0, rejected = 0, released = 0;
      for (const t of results) {
        if (t.milestoneStatus === 1 && !t.hasVoted) pending++;
        if (t.hasVoted && t.myApproved) approved++;
        if (t.hasVoted && !t.myApproved) rejected++;
        if (t.status === 1) released++;
      }
      setStats({ pending, approved, rejected, released });
    } catch (err) {
      console.error('Ward committee load failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(tenderId, approve) {
    if (!signedContract) return;
    setVotingTenderId(tenderId);
    setVoteType(approve ? 'approve' : 'reject');
    try {
      const tx = await signedContract.castVote(tenderId, approve);
      await tx.wait();
      await loadData();
    } catch (err) {
      console.error('Vote failed:', err);
      alert(err.reason || err.message);
    } finally {
      setVotingTenderId(null);
      setVoteType(null);
    }
  }

  const IPFS_GW = 'https://gateway.pinata.cloud/ipfs';

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <span>Ward Committee</span><span className="text-slate-600">/</span><span className="text-slate-400">Sign-Off Ballot</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Ward Committee Sign-Off
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300">3-of-3 Multisig</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Review AI-audited tenders in your ward. Cast your on-chain Approve or Reject vote.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2.5 rounded-xl shadow-md border border-slate-800/60">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Your Wallet</span>
            <span className="text-xs font-mono font-semibold text-slate-200">{shortAddress || 'Not Connected'}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Your Vote', value: stats.pending, icon: Vote, color: 'text-amber-400' },
          { label: 'Approved by You', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Rejected by You', value: stats.rejected, icon: XCircle, color: 'text-red-400' },
          { label: 'Fully Released', value: stats.released, icon: ShieldCheck, color: 'text-cyan-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl bg-slate-900/90 border border-slate-800/60 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-950 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white font-mono">{loading ? '...' : value}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tender Cards */}
      {loading ? (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800/60 p-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
          <p className="text-sm text-slate-400">Loading your assigned tenders...</p>
        </div>
      ) : tenders.length === 0 ? (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800/60 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-950 flex items-center justify-center mb-4">
            <Vote className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-1">No Tenders Assigned</h3>
          <p className="text-sm text-slate-500 max-w-md">You have not been assigned as a ward rep to any tenders yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {tenders.map((tender) => (
            <div key={tender.id} className="rounded-xl bg-slate-900/90 border border-slate-800/60 shadow-xl overflow-hidden">
              {/* Header */}
              <button onClick={() => setExpandedTender(expandedTender === tender.id ? null : tender.id)}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    tender.aiScore >= 75 ? 'bg-emerald-500/10' : tender.aiScore > 0 ? 'bg-red-500/10' : 'bg-slate-800'
                  }`}>
                    <Brain className={`w-6 h-6 ${tender.aiScore >= 75 ? 'text-emerald-400' : tender.aiScore > 0 ? 'text-red-400' : 'text-slate-500'}`} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-white">{tender.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-[11px] text-slate-400"><MapPin className="w-3 h-3" /> {tender.ward}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400"><FileText className="w-3 h-3" /> {tender.contractor}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {tender.aiScore > 0 && (
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono ${
                      tender.aiScore >= 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>AI: {tender.aiScore}%</div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-mono font-semibold text-slate-300">{tender.votesApproved}-of-3</span>
                  </div>
                  {expandedTender === tender.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </button>

              {/* Expanded */}
              {expandedTender === tender.id && (
                <div className="border-t border-slate-800/60 px-6 py-6 space-y-6">
                  {/* Before/After Photos */}
                  {(tender.baselinePhotoIPFS || tender.afterPhotoIPFS) && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Image className="w-4 h-4 text-cyan-400" /> IPFS Evidence Photos
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase">Before</span>
                            {tender.baselinePhotoIPFS && (
                              <a href={`${IPFS_GW}/${tender.baselinePhotoIPFS}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                                IPFS <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="h-40 flex items-center justify-center bg-slate-900">
                            {tender.baselinePhotoIPFS ? (
                              <img src={`${IPFS_GW}/${tender.baselinePhotoIPFS}`} alt="Before" className="w-full h-full object-cover" />
                            ) : (
                              <p className="text-[11px] text-slate-500">No baseline photo</p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase">After</span>
                            {tender.afterPhotoIPFS && (
                              <a href={`${IPFS_GW}/${tender.afterPhotoIPFS}`} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                                IPFS <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="h-40 flex items-center justify-center bg-slate-900">
                            {tender.afterPhotoIPFS ? (
                              <img src={`${IPFS_GW}/${tender.afterPhotoIPFS}`} alt="After" className="w-full h-full object-cover" />
                            ) : (
                              <p className="text-[11px] text-slate-500">Awaiting citizen upload</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Report */}
                  {tender.aiScore > 0 && (
                    <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <Brain className="w-4 h-4 text-cyan-400" /> Gemini AI Audit Report
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: 'Overall', val: tender.aiScore },
                          { label: 'Structural', val: tender.aiStructural },
                          { label: 'Materials', val: tender.aiMaterials },
                          { label: 'Completion', val: tender.aiCompletion },
                        ].map(s => (
                          <div key={s.label} className="rounded-lg bg-slate-900 p-3 text-center">
                            <p className="text-[10px] text-slate-400 uppercase mb-1">{s.label}</p>
                            <p className={`text-xl font-bold font-mono ${s.val >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{s.val}%</p>
                          </div>
                        ))}
                      </div>
                      {tender.citizenNotes && (
                        <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800/60">
                          <p className="text-[10px] text-slate-500 uppercase mb-1">Citizen Notes</p>
                          <p className="text-[11px] text-slate-300">{tender.citizenNotes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vote Status */}
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                      <Vote className="w-4 h-4 text-cyan-400" /> Live Vote Status
                    </h4>
                    <div className="space-y-2">
                      {tender.voters.map((voter, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-300">{voter.role}</span>
                            <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">{voter.wallet}</span>
                          </div>
                          {voter.voted ? (
                            voter.approved ? (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Approved</span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400"><XCircle className="w-4 h-4" /> Rejected</span>
                            )
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Clock className="w-4 h-4" /> Pending</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cast Vote */}
                  {tender.milestoneStatus === 1 && !tender.hasVoted && (
                    <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-300">Cast Your On-Chain Vote</span>
                      </div>
                      <p className="text-[11px] text-slate-400">This action is irreversible and recorded on the Sepolia blockchain.</p>
                      <div className="flex items-center gap-3 pt-1">
                        <button onClick={() => handleVote(tender.id, true)}
                          disabled={votingTenderId === tender.id}
                          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                          {votingTenderId === tender.id && voteType === 'approve' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Broadcasting...</>
                          ) : (
                            <><CheckCircle2 className="w-5 h-5" /> Approve</>
                          )}
                        </button>
                        <button onClick={() => handleVote(tender.id, false)}
                          disabled={votingTenderId === tender.id}
                          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-400 hover:to-rose-400 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                          {votingTenderId === tender.id && voteType === 'reject' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Broadcasting...</>
                          ) : (
                            <><XCircle className="w-5 h-5" /> Reject</>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Already Voted */}
                  {tender.hasVoted && (
                    <div className={`rounded-lg p-4 flex items-center gap-3 ${
                      tender.myApproved ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-red-500/5 border border-red-500/20'
                    }`}>
                      {tender.myApproved ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                      <div>
                        <p className={`text-xs font-semibold ${tender.myApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                          You {tender.myApproved ? 'approved' : 'rejected'} this milestone
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Your vote is recorded on-chain and immutable.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
