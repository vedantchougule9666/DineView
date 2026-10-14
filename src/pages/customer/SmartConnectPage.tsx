import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTable } from '../../context/TableContext';
import { Globe, Wifi, Laptop, ArrowRight, CheckCircle2, QrCode, UtensilsCrossed, Sparkles } from 'lucide-react';

export default function SmartConnectPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setActiveTable } = useTable();

  const tableParam = searchParams.get('table')?.trim().toUpperCase() || 'COUNTER';
  const envAppUrl = (import.meta.env.VITE_APP_URL || import.meta.env.APP_URL || '').replace(/\/$/, '');
  const [networkInfo, setNetworkInfo] = useState<{
    tunnelUrl: string;
    lanUrl: string;
    localUrl: string;
  }>({
    tunnelUrl: envAppUrl,
    lanUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
    localUrl: 'http://localhost:3000',
  });

  const [countdown, setCountdown] = useState<number>(3);
  const [autoRedirect, setAutoRedirect] = useState<boolean>(true);

  // Sync table to context and localStorage
  useEffect(() => {
    if (tableParam) {
      setActiveTable(tableParam);
      try {
        localStorage.setItem('dineview_table', tableParam);
      } catch {}
    }
  }, [tableParam, setActiveTable]);

  // Fetch live network info
  useEffect(() => {
    fetch('/api/network-info')
      .then((res) => res.json())
      .then((data) => {
        const publicTunnel = data.publicUrl || data.tunnelUrl || envAppUrl;
        const localLan = data.localUrl || data.lanUrl || 'http://localhost:3000';
        setNetworkInfo({
          tunnelUrl: publicTunnel,
          lanUrl: localLan,
          localUrl: data.localUrl || 'http://localhost:3000',
        });
      })
      .catch((err) => console.warn('Could not fetch network info:', err));
  }, [envAppUrl]);

  // Countdown auto-redirect to menu
  useEffect(() => {
    if (!autoRedirect) return;

    if (countdown <= 0) {
      navigate(`/?table=${tableParam}`);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, autoRedirect, navigate, tableParam]);

  const handleConnect = (targetBaseUrl: string) => {
    setAutoRedirect(false);
    try {
      localStorage.setItem('dineview_table', tableParam);
    } catch {}

    const cleanBase = targetBaseUrl.replace(/\/$/, '');
    const currentOrigin = window.location.origin.replace(/\/$/, '');

    // If destination matches current origin, navigate internally to avoid reload
    if (cleanBase === currentOrigin) {
      navigate(`/?table=${tableParam}`);
    } else {
      window.location.href = `${cleanBase}/?table=${tableParam}`;
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-border rounded-lg p-6 sm:p-8 shadow-sm text-center">
        {/* Brand Header */}
        <div className="w-14 h-14 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
          <UtensilsCrossed className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-text-primary tracking-tight">
          DineView Menu
        </h1>
        <p className="text-xs uppercase tracking-widest text-text-muted mt-1 mb-4 font-bold">
          Smart Connection Portal
        </p>

        {/* Table Assignment Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-border/30 border border-border text-sm font-bold text-text-primary mb-6">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
          <span>{tableParam !== 'COUNTER' ? `Assigned: Table ${tableParam}` : 'Ordering at Counter'}</span>
        </div>

        {/* Auto-connect Banner */}
        {autoRedirect ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mb-6 flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-900 font-medium">
                Auto-opening menu in <strong className="font-bold text-emerald-950">{countdown}s</strong>...
              </p>
            </div>
            <button
              onClick={() => setAutoRedirect(false)}
              className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 hover:text-emerald-950 px-2 py-1 bg-white border border-emerald-200 rounded"
            >
              Choose Server
            </button>
          </div>
        ) : (
          <div className="bg-bg-primary border border-border rounded-md p-3 mb-6 text-xs text-text-secondary">
            Select your preferred connection option below:
          </div>
        )}

        {/* 3 Connection Options */}
        <div className="flex flex-col gap-3 text-left mb-6">
          {/* Option 1: Online Cloud Tunnel */}
          <button
            onClick={() => handleConnect(networkInfo.tunnelUrl)}
            className="p-4 rounded-md border-2 border-emerald-500/80 bg-emerald-50/40 hover:bg-emerald-50 transition-all flex items-start gap-3 group text-left w-full shadow-xs"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                  🌐 Online Cloud Server
                  <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-bold">BEST</span>
                </span>
                <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-emerald-800 mt-0.5 leading-tight">
                Recommended for any mobile phone (4G/5G, outside Wi-Fi, or cellular).
              </p>
              <p className="text-[10px] font-mono text-emerald-700/80 mt-1 truncate">
                {networkInfo.tunnelUrl}
              </p>
            </div>
          </button>

          {/* Option 2: Local Wi-Fi Network */}
          <button
            onClick={() => handleConnect(networkInfo.lanUrl)}
            className="p-4 rounded-md border border-blue-200 bg-blue-50/30 hover:bg-blue-50 transition-all flex items-start gap-3 group text-left w-full"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Wifi className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950">
                  📶 Restaurant Wi-Fi Network
                </span>
                <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-blue-800 mt-0.5 leading-tight">
                High-speed local connection for devices on restaurant Wi-Fi.
              </p>
              <p className="text-[10px] font-mono text-blue-700/80 mt-1 truncate">
                {networkInfo.lanUrl}
              </p>
            </div>
          </button>

          {/* Option 3: Localhost */}
          <button
            onClick={() => handleConnect(networkInfo.localUrl)}
            className="p-3.5 rounded-md border border-border bg-white hover:bg-neutral-50 transition-all flex items-start gap-3 group text-left w-full"
          >
            <div className="w-9 h-9 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center shrink-0 mt-0.5">
              <Laptop className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">
                  💻 Localhost (Host Device)
                </span>
                <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-[11px] text-neutral-600 mt-0.5 leading-tight">
                For managers & staff testing on the host computer.
              </p>
              <p className="text-[10px] font-mono text-neutral-500 mt-0.5 truncate">
                {networkInfo.localUrl}
              </p>
            </div>
          </button>
        </div>

        {/* Quick Direct Button */}
        <button
          onClick={() => {
            setAutoRedirect(false);
            navigate(`/?table=${tableParam}`);
          }}
          className="w-full bg-text-primary text-white py-3 px-6 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <span>Open Menu Now</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-[10px] text-text-muted mt-4">
          DineView Smart QR Router • No app download required
        </p>
      </div>
    </div>
  );
}
