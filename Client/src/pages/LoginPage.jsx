import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Wallet, AlertCircle, Loader2, ScanLine } from 'lucide-react';
import useWallet from '../hooks/useWallet';

const ROLE_ROUTES = {
  municipal: '/dashboard',
  contractor: '/contractor',
  ward: '/ward-committee',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { connectWallet, loading, error } = useWallet();
  const [roleError, setRoleError] = useState(null);

  const handleConnect = async () => {
    setRoleError(null);
    const result = await connectWallet();

    if (!result) return; // connection failed — error shown via hook

    if (!result.role) {
      setRoleError(
        'This wallet is not registered on the CivicTrust contract. Contact your municipal admin to whitelist your address.'
      );
      return;
    }

    navigate(ROLE_ROUTES[result.role]);
  };

  const displayError = roleError || error;

  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-white overflow-hidden select-none">
      {/* Scenic Background */}
      <div className="absolute inset-0 z-0">
        <img
          alt="South African township infrastructure and municipal tenders"
          className="w-full h-full object-cover object-center filter contrast-[1.02]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAPqdJRYQCxkQnCS3b4cfsYQNngXvLAC3aF8OWf8jj9bPM79pxA3AIeJkoi8KBNVuRxfg14TnxKBXUvKa8F5MM5djkOVFpeGMOTPuS6flRcR8JOWSyGwNdM-2BhCsR3x46Sn6xGzWdsS22VKwwXQmCwxhbAAMVaanQ-_wCehMinddIHDqbe-CmDdT7Mua4v_Wue1xgV0pSgaa_E4kmhz1tW4xP8VbpWujh3JZXubclh"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/35 mix-blend-multiply pointer-events-none" />
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      </div>

      {/* Main Content */}
      <main className="relative z-10 min-h-screen w-full flex items-center px-6 sm:px-12 md:px-20 lg:px-28 xl:px-36 py-12">
        <div className="w-full max-w-[440px] p-6 sm:p-8 rounded-2xl">
          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-2 mb-3 tracking-widest text-xs uppercase font-semibold text-sky-400/90">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>CivicTrust Portal</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-light tracking-tight text-white/95">
              Welcome!
            </h1>
            <p className="mt-2 text-base sm:text-lg text-slate-300 font-normal tracking-wide">
              Connect your wallet to access your dashboard.
            </p>
          </header>

          {/* Wallet Connect */}
          <div className="space-y-5">
            {/* Connect Wallet Button */}
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-4 px-6 bg-[#2575c0] hover:bg-[#1d63a8] disabled:bg-[#1d63a8]/60 text-white font-bold text-sm tracking-wider rounded-xl shadow-lg hover:shadow-sky-900/40 transition duration-200 active:scale-[0.99] uppercase flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Detecting Role On-Chain...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  <span>Connect MetaMask Wallet</span>
                </>
              )}
            </button>

            {/* Error Message */}
            {displayError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 leading-relaxed">{displayError}</p>
              </div>
            )}

            {/* Role Info */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Who Can Log In?</p>
              <div className="space-y-2">
                {[
                  { role: 'Municipality Official', desc: 'Whitelisted municipal wallet' },
                  { role: 'Contractor', desc: 'Wallet assigned to a tender' },
                  { role: 'Ward Committee Rep', desc: 'Designated ward rep wallet' },
                ].map(({ role, desc }) => (
                  <div key={role} className="flex items-center gap-2.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-slate-200 font-medium">{role}</span>
                    <span className="text-slate-500">— {desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 py-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] text-slate-500 uppercase tracking-widest">Open Access</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Open Access Button */}
            <button
              type="button"
              onClick={() => navigate('/citizen')}
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 text-slate-200 hover:text-white text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2"
            >
              <ScanLine className="w-4 h-4 text-cyan-400" />
              Citizen Area Scanner — No Wallet Needed
            </button>
          </div>

          {/* Footer */}
          <footer className="mt-12 text-[10px] text-slate-400/80 tracking-wide flex items-center gap-2">
            <span>&copy; 2024 CivicTrust.</span>
            <span className="text-slate-600">|</span>
            <span>Sepolia Testnet</span>
            <span className="text-slate-600">|</span>
            <span>Powered by Ethereum</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
