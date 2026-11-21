import { useState } from 'react';
import {
  MapPin, Radar, Radio, Camera, ImagePlus, Crosshair,
  Pencil, RefreshCw, Clock, Users, Check, Shield, Sparkles, Lock, Loader2, ExternalLink, Brain,
} from 'lucide-react';
import { API_URL } from '../config/supabase';

export default function CitizenScanner() {
  const [gpsLocked, setGpsLocked] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [nearbyTenders, setNearbyTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [evidence, setEvidence] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [error, setError] = useState(null);

  const IPFS_GW = 'https://gateway.pinata.cloud/ipfs';

  const handleScanLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation not supported');
    setScanning(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setGpsCoords(coords);
        setGpsLocked(true);

        // Fetch nearby tenders
        try {
          const res = await fetch(`${API_URL}/tenders/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=5000`);
          const data = await res.json();
          setNearbyTenders(data.tenders || []);
        } catch (err) {
          console.error('Nearby tenders fetch failed:', err);
        }
        setScanning(false);
      },
      (err) => {
        setError('GPS access denied. Please enable location services.');
        setScanning(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleUploadEvidence = async () => {
    if (!photo || !selectedTender) return setError('Select a tender and upload a photo');
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('tenderId', selectedTender.id);
      formData.append('milestoneIndex', selectedTender.current_milestone || 0);
      formData.append('citizenNotes', notes);
      if (gpsCoords) {
        formData.append('gpsLat', gpsCoords.lat);
        formData.append('gpsLng', gpsCoords.lng);
      }

      const res = await fetch(`${API_URL}/evidence`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setEvidence(data.evidence);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!evidence || !selectedTender) return;
    setAuditing(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId: selectedTender.id,
          milestoneIndex: selectedTender.current_milestone || 0,
          beforePhotoUrl: selectedTender.baseline_photo_url || `${IPFS_GW}/${selectedTender.baseline_ipfs_cid}`,
          afterPhotoUrl: evidence.photoUrl,
          evidenceId: evidence.id,
          scopeOfWork: selectedTender.scope_of_work || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audit failed');
      setAuditResult(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setAuditing(false);
    }
  };

  return (
    <>
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Citizen Area Scanner &amp; Evidence Upload
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Scan local municipal tenders by geolocation, upload photo evidence for Gemini AI audit. No wallet needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs ${gpsLocked ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' : 'text-slate-400 bg-slate-800/40 border-slate-700'} border px-2.5 py-1 rounded-md`}>
            <MapPin className="w-3.5 h-3.5" />
            {gpsLocked ? 'GPS Locked' : 'GPS Ready'}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">{error}</div>
      )}

      {/* Location Bar */}
      <div className="bg-gradient-to-r from-[#112338] via-[#0f2d42] to-[#122336] border border-cyan-900/60 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg glow-soft">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">Location Status</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${gpsLocked ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                {gpsLocked ? 'Locked' : 'Awaiting'}
              </span>
            </div>
            <p className="text-xs font-mono text-cyan-200/90 mt-0.5">
              {gpsCoords
                ? `GPS: ${gpsCoords.lat.toFixed(4)}°, ${gpsCoords.lng.toFixed(4)}° | Accuracy: ±${gpsCoords.accuracy.toFixed(1)}m`
                : 'Tap "Scan My Location" to detect nearby tenders'}
            </p>
          </div>
        </div>
        <button onClick={handleScanLocation} disabled={scanning}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-semibold text-xs tracking-wide transition shadow-md shadow-cyan-500/25 flex-shrink-0 disabled:opacity-60">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
          <span>{scanning ? 'Scanning...' : 'Scan My Location'}</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-7 space-y-6">
          {/* Nearby Tenders */}
          <section className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Nearby Active Municipal Tenders</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">Radius: 5 km</span>
            </div>
            {!gpsLocked ? (
              <div className="py-8 text-center text-slate-500">
                <Radar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs">Scan your location to discover nearby tenders.</p>
              </div>
            ) : nearbyTenders.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs">No tenders found near your location.</p>
                <p className="text-[10px] text-slate-600 mt-1">Tenders within 5km radius will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {nearbyTenders.map((t) => (
                  <button key={t.id} onClick={() => setSelectedTender(t)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selectedTender?.id === t.id
                        ? 'border-cyan-500/40 bg-cyan-950/20 shadow-md'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                    }`}>
                    <p className="text-xs font-semibold text-slate-200 truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.ward}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-mono text-cyan-400">{t.total_escrow_eth} ETH</span>
                      <span className="text-[10px] text-slate-500">{t.distance_m}m away</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Upload Photo */}
          <section className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Capture or Upload Site Photo</h2>
              </div>
            </div>
            <label className="border-2 border-dashed border-slate-700/80 hover:border-cyan-500/60 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-[#0d1527]/50 hover:bg-[#131f38]/40 group">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { setPhoto(e.target.files[0]); setEvidence(null); setAuditResult(null); }} />
              <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition-transform">
                <ImagePlus className="w-7 h-7" />
              </div>
              {photo ? (
                <>
                  <h3 className="text-sm font-semibold text-emerald-400 mb-1">{photo.name}</h3>
                  <p className="text-xs text-slate-400">Click to replace</p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Upload or Capture Evidence</h3>
                  <p className="text-xs text-slate-400">JPG, PNG, WebP (Max 20MB)</p>
                </>
              )}
            </label>
          </section>

          {/* Notes */}
          <section className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Pencil className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Citizen Observation Notes</h2>
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Asphalting completed on the northern lane..."
              rows={3}
              className="w-full bg-[#0b1120] border border-slate-700/80 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none" />
          </section>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Results */}
          <section className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Gemini AI Audit Results</h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">v2.0 Flash</span>
            </div>

            {auditResult ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className={`text-5xl font-extrabold tracking-tight font-mono ${
                    auditResult.overall_score >= 75 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {auditResult.overall_score}<span className="text-2xl text-slate-400 font-normal">/100</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    auditResult.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>{auditResult.passed ? 'PASSED' : 'FAILED'}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Structural', val: auditResult.structural_score },
                    { label: 'Materials', val: auditResult.materials_score },
                    { label: 'Completion', val: auditResult.completion_score },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg bg-slate-950 p-3 text-center border border-slate-800">
                      <p className="text-[10px] text-slate-400 uppercase mb-1">{s.label}</p>
                      <p className={`text-lg font-bold font-mono ${s.val >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{s.val}%</p>
                    </div>
                  ))}
                </div>

                {auditResult.summary && (
                  <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">AI Summary</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{auditResult.summary}</p>
                  </div>
                )}

                {auditResult.defects?.length > 0 && (
                  <div className="rounded-lg bg-red-500/5 p-3 border border-red-500/20">
                    <p className="text-[10px] text-red-400 uppercase mb-1 font-semibold">Defects Found</p>
                    <ul className="list-disc list-inside text-xs text-red-300 space-y-0.5">
                      {auditResult.defects.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-extrabold text-white tracking-tight font-mono">--<span className="text-2xl text-slate-400 font-normal">/100</span></span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-400 h-2.5 rounded-full" style={{ width: '0%' }} />
                </div>
                <p className="text-xs text-slate-500 text-center">Upload evidence and run the AI audit to see results</p>
              </>
            )}
          </section>

          {/* Submit Actions */}
          <section className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Evidence Submission &amp; AI Audit</h3>
              <p className="text-xs text-slate-400 mt-1">Upload your photo to IPFS, then trigger Gemini AI comparison.</p>
            </div>

            {selectedTender && (
              <div className="bg-cyan-950/30 border border-cyan-900/40 rounded-lg p-3 flex items-center justify-between text-xs">
                <span className="text-slate-300 truncate">{selectedTender.title}</span>
                <span className="font-mono text-cyan-400 font-semibold flex-shrink-0 ml-2">{selectedTender.total_escrow_eth} ETH</span>
              </div>
            )}

            {/* Step 1: Upload to IPFS */}
            {!evidence ? (
              <button type="button" onClick={handleUploadEvidence}
                disabled={uploading || !photo || !selectedTender}
                className="w-full py-3.5 px-4 rounded-lg bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-cyan">
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Pinning to IPFS...</span></>
                ) : (
                  <><Camera className="w-4 h-4" /><span>Upload Photo to IPFS</span></>
                )}
              </button>
            ) : !auditResult ? (
              /* Step 2: Run AI Audit */
              <>
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>Photo pinned to IPFS: <a href={evidence.photoUrl} target="_blank" rel="noopener noreferrer" className="font-mono underline">{evidence.ipfsCid.slice(0, 12)}...</a></span>
                </div>
                <button type="button" onClick={handleRunAudit}
                  disabled={auditing}
                  className="w-full py-3.5 px-4 rounded-lg bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white font-bold text-sm tracking-wide shadow-lg flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 glow-cyan">
                  {auditing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>Running Gemini AI Audit...</span></>
                  ) : (
                    <><Sparkles className="w-4 h-4" /><span>Run Gemini AI Audit</span></>
                  )}
                </button>
              </>
            ) : (
              /* Step 3: Done */
              <div className="flex items-center gap-2 text-xs text-emerald-400 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                <Check className="w-4 h-4" />
                <span>Evidence uploaded and AI audit complete. {auditResult.passed ? 'Tender passed — awaiting ward committee vote.' : 'Tender flagged as disputed.'}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span>No wallet required — open access for all citizens</span>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
