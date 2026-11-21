export default function Footer() {
  return (
    <footer className="mt-auto px-8 py-4 border-t border-slate-800/60 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
        <span>CivicTrust Smart Contract Registry v2.4 &bull; Municipal Transparency Protocol</span>
      </div>
      <div className="flex items-center gap-4 mt-2 sm:mt-0 font-mono text-[11px]">
        <span>Gas: 24 nAVAX</span>
        <span className="text-slate-600">|</span>
        <span>CertiK &amp; Halborn Audited</span>
      </div>
    </footer>
  );
}
