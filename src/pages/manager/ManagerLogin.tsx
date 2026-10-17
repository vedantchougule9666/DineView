import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChefHat, Lock, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

export default function ManagerLogin() {
  const [passcode, setPasscode] = useState('');
  const [managerName, setManagerName] = useState('Chef Robert');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = passcode.trim();
    // Default manager passcodes: 'dineview2025' or 'admin123'
    if (trimmed === 'dineview2025' || trimmed === 'admin123' || trimmed === '1234') {
      try {
        sessionStorage.setItem('dineview_manager_auth', 'true');
        sessionStorage.setItem('dineview_manager_name', managerName.trim() || 'Kitchen Manager');
      } catch {}

      const destination = (location.state as any)?.from?.pathname || '/manager/orders';
      navigate(destination, { replace: true });
    } else {
      setError('Invalid manager passcode. Default demo passcode is "dineview2025".');
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-border rounded-lg p-8 shadow-sm">
        <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
          <ChefHat className="w-7 h-7" />
        </div>

        <h1 className="text-2xl font-serif text-center font-bold text-text-primary tracking-tight">
          Kitchen Manager
        </h1>
        <p className="text-xs uppercase tracking-widest text-text-muted text-center mt-1 mb-8 font-bold">
          DineView Dispatch Portal
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-sm text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-snug">{error}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-text-secondary mb-1.5">
              Manager / Chef Name
            </label>
            <input
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="e.g. Chef Robert"
              className="w-full border border-border px-3.5 py-2 rounded-sm text-sm text-text-primary focus:outline-none focus:border-text-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-text-secondary mb-1.5">
              Manager Passcode *
            </label>
            <div className="relative">
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode (e.g. dineview2025)"
                className="w-full border border-border px-3.5 py-2 rounded-sm text-sm text-text-primary focus:outline-none focus:border-text-primary pe-10"
                required
                autoFocus
              />
              <Lock className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Default passcode: <code className="bg-neutral-100 px-1 py-0.5 rounded text-text-primary font-mono font-bold">dineview2025</code>
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-text-primary text-white py-3 px-6 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-all flex items-center justify-center gap-2 mt-4 shadow-xs"
          >
            <span>Access Kitchen Queue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/60 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-text-muted hover:text-text-primary font-bold uppercase tracking-wider transition-colors"
          >
            ← Return to Customer Menu
          </button>
        </div>
      </div>
    </div>
  );
}
