import { useState } from 'react';
import { MapPin, Camera, Shield, UserPlus, Lock, Info, ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import useWallet from '../hooks/useWallet';
import { API_URL } from '../config/supabase';
import { CHAIN_CONFIG } from '../config/contract';
import { ethers } from 'ethers';

export default function CreateFundTender() {
  const { signedContract, account } = useWallet();

  const [tenderTitle, setTenderTitle] = useState('');
  const [ward, setWard] = useState('');
  const [contractorWallet, setContractorWallet] = useState('');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [deadline, setDeadline] = useState('');
  const [baselinePhoto, setBaselinePhoto] = useState(null);
  const [signerWallets, setSignerWallets] = useState(['', '', '']);

  // Milestones
  const [milestones, setMilestones] = useState([{ description: 'Initial milestone', amount: '' }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  const totalEscrow = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  const handleSignerChange = (index, value) => {
    const updated = [...signerWallets];
    updated[index] = value;
    setSignerWallets(updated);
  };

  const addMilestone = () => {
    if (milestones.length >= 10) return;
    setMilestones([...milestones, { description: '', amount: '' }]);
  };

  const removeMilestone = (index) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (index, field, value) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleSubmit = async () => {
    if (!signedContract) return setError('Wallet not connected');
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Pin baseline photo to IPFS
      let baselineCid = '';
      if (baselinePhoto) {
        setSubmitStep('Pinning baseline photo to IPFS...');
        const formData = new FormData();
        formData.append('photo', baselinePhoto);
        formData.append('tenderId', '0'); // placeholder, will be updated
        const pinRes = await fetch(`${API_URL}/evidence`, { method: 'POST', body: formData });
        const pinData = await pinRes.json();
        baselineCid = pinData.evidence?.ipfsCid || '';
      }

      // 2. Validate addresses
      if (!ethers.isAddress(contractorWallet)) {
        throw new Error('Invalid contractor wallet address');
      }
      for (let i = 0; i < 3; i++) {
        if (!ethers.isAddress(signerWallets[i])) {
          throw new Error(`Invalid ward rep wallet address #${i + 1}`);
        }
      }
      for (const m of milestones) {
        if (!m.amount || parseFloat(m.amount) <= 0) {
          throw new Error('Each milestone must have an amount greater than 0');
        }
      }

      // 3. Prepare on-chain call (struct tuple)
      setSubmitStep('Broadcasting transaction to Sepolia...');

      const gpsLat = latitude ? Math.round(parseFloat(latitude) * 1e6) : 0;
      const gpsLng = longitude ? Math.round(parseFloat(longitude) * 1e6) : 0;
      const deadlineTs = deadline ? Math.floor(new Date(deadline).getTime() / 1000) : Math.floor(Date.now() / 1000) + 86400 * 90;

      const milestoneAmounts = milestones.map(m => ethers.parseEther(m.amount));
      const milestoneDescs = milestones.map(m => m.description || 'Milestone');

      // The contract expects a single CreateTenderParams struct
      const params = {
        contractor: ethers.getAddress(contractorWallet),
        title: tenderTitle,
        ward: ward || 'Unassigned',
        scopeIPFS: '',
        baselineIPFS: baselineCid,
        gpsLat,
        gpsLng,
        deadline: deadlineTs,
        wardReps: signerWallets.map(w => ethers.getAddress(w)),
        milestoneAmounts,
        milestoneDescs,
      };

      const tx = await signedContract.createTender(params, {
        value: milestoneAmounts.reduce((a, b) => a + b, 0n),
      });

      setSubmitStep('Waiting for confirmation...');
      const receipt = await tx.wait();
      setTxHash(receipt.hash);

      // 3. Sync to Supabase
      setSubmitStep('Syncing to database...');
      try {
        const tenderCount = await signedContract.tenderCount();
        await fetch(`${API_URL}/sync-tender`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenderId: Number(tenderCount) }),
        });
      } catch { /* non-critical */ }

      setIsSubmitted(true);
    } catch (err) {
      console.error('Create tender failed:', err);
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  return (
    <div className="flex flex-col w-full space-y-7">
      {/* Title / Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-cyan-400">
            <span>Tenders</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">New Municipal Disbursement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Create &amp; Fund New Tender
            <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border-0">Sepolia</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Deploy milestone-locked municipal public works contract with decentralized multisig community oversight.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-xl shadow-md">
          <div className={`w-2.5 h-2.5 rounded-full ${isSubmitted ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Contract State</span>
            <span className="text-xs font-semibold text-slate-200">{isSubmitted ? 'Published' : 'Awaiting Submission'}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
      )}

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* LEFT: Tender Form */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl bg-slate-900/95 p-6 sm:p-7 shadow-xl space-y-6">
            {/* Title & Ward */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
              <div className="sm:col-span-7 space-y-2">
                <label className="block text-xs font-semibold tracking-wide text-slate-300">Tender Title</label>
                <input type="text" value={tenderTitle} onChange={(e) => setTenderTitle(e.target.value)}
                  placeholder="e.g. Soweto Community Hall Renovation & Drainage"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium transition-all shadow-inner" />
              </div>
              <div className="sm:col-span-5 space-y-2">
                <label className="block text-xs font-semibold tracking-wide text-slate-300">Ward</label>
                <div className="relative">
                  <select value={ward} onChange={(e) => setWard(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-950 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 appearance-none pr-9 font-medium shadow-inner cursor-pointer">
                    <option value="">Select ward...</option>
                    <option>Ward 12, Johannesburg</option>
                    <option>Ward 14, Johannesburg</option>
                    <option>Ward 33, Soweto West</option>
                    <option>Ward 58, Diepkloof</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400"><ChevronDown className="w-4 h-4" /></div>
                </div>
              </div>
            </div>

            {/* Contractor Wallet & Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
              <div className="sm:col-span-7 space-y-2">
                <label className="block text-xs font-semibold tracking-wide text-slate-300">Contractor Wallet Address</label>
                <input type="text" value={contractorWallet} onChange={(e) => setContractorWallet(e.target.value)}
                  placeholder="0x..."
                  className="w-full pl-4 pr-10 py-2.5 rounded-lg bg-slate-950 text-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner" />
              </div>
              <div className="sm:col-span-5 space-y-2">
                <label className="block text-xs font-semibold tracking-wide text-slate-300">Deadline</label>
                <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-950 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner" />
              </div>
            </div>

            {/* Scope of Work */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wide text-slate-300">Scope of Work Rubric</label>
              <textarea value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)}
                placeholder="Scope of Work rubric for contractors and milestone verifiers..."
                rows={3}
                className="w-full p-4 rounded-lg bg-slate-950 text-slate-200 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 leading-relaxed shadow-inner" />
            </div>

            {/* Milestones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold tracking-wide text-slate-300">Milestones ({milestones.length})</label>
                <button type="button" onClick={addMilestone} disabled={milestones.length >= 10}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Add Milestone
                </button>
              </div>
              {milestones.map((m, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/60">
                  <span className="text-xs font-mono text-slate-500 mt-2.5 w-5">{idx + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <input type="text" value={m.description} onChange={(e) => updateMilestone(idx, 'description', e.target.value)}
                      placeholder="Milestone description..."
                      className="w-full px-3 py-2 rounded bg-slate-900 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-slate-800" />
                    <div className="relative">
                      <input type="number" step="0.001" value={m.amount} onChange={(e) => updateMilestone(idx, 'amount', e.target.value)}
                        placeholder="0.0"
                        className="w-full pl-3 pr-14 py-2 rounded bg-slate-900 text-slate-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 border border-slate-800" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-cyan-400">ETH</span>
                    </div>
                  </div>
                  {milestones.length > 1 && (
                    <button onClick={() => removeMilestone(idx)} className="text-slate-500 hover:text-red-400 mt-2.5"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
            </div>

            {/* GPS & Baseline Photo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
              <div className="rounded-xl bg-slate-950 p-4 shadow-md space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">GPS Coordinates</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-1">Latitude</label>
                    <input type="text" value={latitude} onChange={(e) => setLatitude(e.target.value)}
                      placeholder="-26.248538"
                      className="w-full bg-slate-900 px-2 py-1.5 rounded text-[11px] text-slate-300 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-slate-500 mb-1">Longitude</label>
                    <input type="text" value={longitude} onChange={(e) => setLongitude(e.target.value)}
                      placeholder="27.854019"
                      className="w-full bg-slate-900 px-2 py-1.5 rounded text-[11px] text-slate-300 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-slate-950 p-4 shadow-md space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200">Baseline 'Before' Photo</span>
                </div>
                <label className="relative w-full h-28 rounded-lg overflow-hidden bg-slate-900 shadow-inner flex items-center justify-center cursor-pointer hover:bg-slate-800/50 transition-colors border-2 border-dashed border-slate-700 hover:border-cyan-500/40">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setBaselinePhoto(e.target.files[0])} />
                  {baselinePhoto ? (
                    <div className="text-center">
                      <Camera className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xs text-emerald-400 font-medium">{baselinePhoto.name}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Camera className="w-6 h-6 text-slate-600 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Upload baseline photo</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Approvals & Summary */}
        <div className="lg:col-span-5 space-y-6">
          {/* Ward Committee Wallets */}
          <div className="rounded-xl bg-slate-900/95 p-6 sm:p-7 shadow-xl space-y-5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  Ward Committee Approvals
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold">3-of-3 Multisig</span>
              </div>
              <p className="text-xs text-slate-400">Assign 3 ward rep wallets for multi-sig approval.</p>
            </div>
            <div className="space-y-3.5 pt-1">
              {['Chairperson', 'Community Engineer', 'Civic Auditor'].map((role, idx) => (
                <div key={idx} className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-300">Wallet {idx + 1} ({role})</label>
                  <input type="text" value={signerWallets[idx]} onChange={(e) => handleSignerChange(idx, e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-950 text-slate-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-inner" />
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-slate-900/95 p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white tracking-tight">Summary / Estimate</h2>
              <span className="text-xs font-mono text-slate-400">Sepolia Testnet</span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Milestones</span>
                <span className="font-mono text-slate-200 font-semibold">{milestones.length}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-300">Escrow Lock</span>
                <span className="font-mono text-cyan-400 font-bold text-sm">{totalEscrow.toFixed(4)} ETH</span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-950 flex items-center justify-between shadow-inner">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Total Treasury Commitment</span>
                  <span className="text-xs text-slate-300">Milestone Tranches: {milestones.length}</span>
                </div>
                <div className="text-lg font-bold font-mono text-white">
                  {totalEscrow.toFixed(4)} <span className="text-cyan-400 text-xs">ETH</span>
                </div>
              </div>
            </div>

            <button type="button" onClick={handleSubmit}
              disabled={isSubmitting || isSubmitted || !tenderTitle || !contractorWallet || totalEscrow === 0}
              className={`w-full py-4 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                isSubmitted
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-500 text-slate-950 shadow-cyan-500/25 hover:shadow-cyan-400/40 hover:scale-[1.01] active:scale-[0.99]'
              }`}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>{submitStep}</span></>
              ) : isSubmitted ? (
                <><Lock className="w-5 h-5" /><span>Funds Locked &amp; Tender Published!</span></>
              ) : (
                <><Lock className="w-5 h-5" /><span>Lock Funds &amp; Create Tender</span></>
              )}
            </button>

            {txHash && (
              <a href={`${CHAIN_CONFIG.blockExplorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="block text-center text-[11px] text-cyan-400 hover:text-cyan-300 font-mono">
                View on Etherscan &rarr;
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
