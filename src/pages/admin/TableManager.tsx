import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTable, RestaurantTable, formatDemoTableName } from '../../context/TableContext';
import { Plus, Trash2, Printer, ExternalLink, QrCode, Copy, Check, Sparkles, RefreshCw, Wifi, Globe } from 'lucide-react';

export default function TableManager() {
  const { tables, allTables, loading, addTable, toggleTableActive, deleteTable, refresh } = useTable();
  const [tableNumber, setTableNumber] = useState('');
  const [tableName, setTableName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine base URL following the APP_URL pattern or default to local Wi-Fi IP for mobile scanning
  const envUrl = import.meta.env.VITE_APP_URL || import.meta.env.APP_URL;
  const initialBaseUrl = (envUrl && typeof envUrl === 'string' && !envUrl.includes('MY_APP_URL'))
    ? envUrl.replace(/\/$/, '')
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  const [baseUrl, setBaseUrl] = useState<string>(initialBaseUrl);
  const [detectedIpUrl, setDetectedIpUrl] = useState<string>('http://10.14.5.42:3000');
  const [publicOnlineUrl, setPublicOnlineUrl] = useState<string>(initialBaseUrl);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const detectNetworkIp = async () => {
    setIsDetecting(true);
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const data = await res.json();
        if (data.publicUrl) {
          setPublicOnlineUrl(data.publicUrl);
          setBaseUrl(data.publicUrl);
        } else if (data.url) {
          setBaseUrl(data.url);
        }
        if (data.localUrl) {
          setDetectedIpUrl(data.localUrl);
        }
      }
    } catch (e) {
      console.warn('Could not auto-detect network info:', e);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    detectNetworkIp();
  }, []);

  const getTableUrl = (tableId: string) => {
    return `${baseUrl}/?table=${tableId}`;
  };

  const handleCopyLink = async (tableId: string) => {
    try {
      await navigator.clipboard.writeText(getTableUrl(tableId));
      setCopiedId(tableId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedNum = tableNumber.trim();
    if (!trimmedNum) {
      setError('Please enter a table number or ID (e.g. 05 or T05)');
      return;
    }

    // Format ID to Txx pattern if number is entered
    let formattedId = trimmedNum.toUpperCase();
    if (!formattedId.startsWith('T')) {
      const num = parseInt(formattedId, 10);
      if (!isNaN(num)) {
        formattedId = `T${num.toString().padStart(2, '0')}`;
      } else {
        formattedId = `T${formattedId}`;
      }
    }

    // Check duplicate
    if (allTables.some((t) => t.id.toUpperCase() === formattedId)) {
      setError(`Table with ID ${formattedId} already exists`);
      return;
    }

    setIsSubmitting(true);
    try {
      const finalName = tableName.trim() || formatDemoTableName(formattedId);
      await addTable(formattedId, finalName);
      setTableNumber('');
      setTableName('');
    } catch (err) {
      console.error('Failed to add table', err);
      setError('Failed to create table. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedDemoTables = async () => {
    setIsSubmitting(true);
    try {
      const demoList = [
        { id: 'T01', name: 'Table 1 (Window)' },
        { id: 'T02', name: 'Table 2 (Booth)' },
        { id: 'T03', name: 'Table 3 (Patio)' },
        { id: 'T04', name: 'Table 4 (Center)' },
        { id: 'T05', name: 'Table 5 (VIP)' },
        { id: 'T06', name: 'Table 6 (Balcony)' },
      ];
      for (const item of demoList) {
        if (!allTables.some((t) => t.id === item.id)) {
          await addTable(item.id, item.name);
        }
      }
    } catch (err) {
      console.error('Failed to seed tables', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const activeTablesList = allTables.filter((t) => t.active);

  return (
    <div>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-text-primary">Tables & QR Codes</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage restaurant tables and generate scannable ordering QR codes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-sm text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
            title="Refresh tables"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {allTables.length === 0 && (
            <button
              onClick={handleSeedDemoTables}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 text-accent rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-accent/20 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Seed Demo Tables
            </button>
          )}
          <button
            onClick={handlePrint}
            disabled={activeTablesList.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-text-primary text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print All QRs ({activeTablesList.length})
          </button>
        </div>
      </div>

      {/* Mobile QR Scanning Target Address */}
      <div className="bg-white border border-border rounded-sm p-5 mb-8 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <QrCode className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Active QR Target URL:
              </span>
              <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded border ${
                baseUrl.startsWith('https://') 
                  ? 'bg-blue-50 text-blue-900 border-blue-200' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {baseUrl}
              </span>
              {baseUrl.startsWith('https://') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-100 text-blue-800">
                  <Globe className="w-2.5 h-2.5" />
                  Public Online (Any Network / 5G / 4G)
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              {baseUrl.startsWith('https://') 
                ? '🌐 Public Online mode: ANY mobile phone on mobile data (Jio, Airtel, 4G/5G) or any Wi-Fi can scan and open this directly.' 
                : '📶 Local Wi-Fi mode: Scanning phones must be connected to your local Wi-Fi router.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {publicOnlineUrl && (
              <button
                type="button"
                onClick={() => setBaseUrl(publicOnlineUrl)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors border ${
                  baseUrl === publicOnlineUrl
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Public Online (Any Network)
              </button>
            )}
            <button
              type="button"
              onClick={() => setBaseUrl(detectedIpUrl)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors border ${
                baseUrl === detectedIpUrl
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Local Wi-Fi
            </button>
            <button
              type="button"
              onClick={() => setBaseUrl('http://localhost:3000')}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors border ${
                baseUrl === 'http://localhost:3000'
                  ? 'bg-neutral-800 text-white border-neutral-800'
                  : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
              }`}
            >
              localhost
            </button>
          </div>
        </div>

        {/* Custom URL Input for custom domain or tunnels */}
        <div className="pt-2.5 border-t border-border/60 flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted shrink-0">
            Custom URL / Tunnel:
          </span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value.trim())}
            placeholder="https://your-public-url.com"
            className="flex-1 text-xs font-mono px-3 py-1 border border-border rounded-sm bg-bg-primary text-text-primary focus:outline-none focus:border-text-primary"
          />
          <button
            type="button"
            onClick={detectNetworkIp}
            disabled={isDetecting}
            className="flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded-sm hover:bg-bg-secondary text-text-secondary disabled:opacity-50"
            title="Refresh network URL"
          >
            <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
            Auto-Detect
          </button>
        </div>
      </div>

      {/* Add Table Form Card */}
      <div className="bg-white border border-border rounded-sm p-6 mb-8">
        <h2 className="text-lg font-serif text-text-primary mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-accent" />
          Add New Table
        </h2>
        <form onSubmit={handleAddTable} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs uppercase tracking-wider font-bold text-text-secondary mb-1.5">
              Table Number / ID *
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="e.g. 05 or T05"
              className="w-full border border-border px-3.5 py-2 rounded-sm text-sm text-text-primary outline-none focus:border-text-primary transition-colors"
              required
            />
          </div>
          <div className="sm:col-span-5">
            <label className="block text-xs uppercase tracking-wider font-bold text-text-secondary mb-1.5">
              Display Name (Optional)
            </label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Table 5 or Patio Booth"
              className="w-full border border-border px-3.5 py-2 rounded-sm text-sm text-text-primary outline-none focus:border-text-primary transition-colors"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-text-primary text-white py-2 px-4 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Table'}
            </button>
          </div>
        </form>
        {error && (
          <p className="text-xs text-red-600 mt-2 font-medium">{error}</p>
        )}
      </div>

      {/* Tables List CRUD */}
      <div className="bg-white border border-border rounded-sm overflow-hidden mb-12">
        <div className="px-6 py-4 border-b border-border bg-bg-primary/50 flex items-center justify-between">
          <h2 className="font-serif text-lg text-text-primary">Configured Tables</h2>
          <span className="text-xs text-text-secondary font-medium">
            Total: {allTables.length} | Active: {activeTablesList.length}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-secondary">Loading tables...</div>
        ) : allTables.length === 0 ? (
          <div className="p-12 text-center text-text-secondary flex flex-col items-center gap-3">
            <QrCode className="w-8 h-8 text-text-muted" />
            <p>No tables created yet.</p>
            <button
              onClick={handleSeedDemoTables}
              className="text-xs text-accent underline font-bold uppercase tracking-wider hover:opacity-80"
            >
              Seed Sample Tables (T01 - T06)
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg-primary border-b border-border text-xs uppercase tracking-widest text-text-muted">
                <tr>
                  <th className="px-6 py-4 font-bold">ID</th>
                  <th className="px-6 py-4 font-bold">Name</th>
                  <th className="px-6 py-4 font-bold">QR Target URL</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {allTables.map((t) => {
                  const url = getTableUrl(t.id);
                  return (
                    <tr key={t.id} className="hover:bg-bg-primary/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-text-primary">
                        <span className="px-2.5 py-1 bg-border/40 rounded-sm text-xs">
                          {t.id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-text-primary">
                        {t.name}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-text-secondary max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{url}</span>
                          <button
                            onClick={() => handleCopyLink(t.id)}
                            className="p-1 hover:text-text-primary text-text-muted transition-colors shrink-0"
                            title="Copy QR link"
                          >
                            {copiedId === t.id ? (
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 hover:text-text-primary text-text-muted transition-colors shrink-0"
                            title="Open menu as this table"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            t.active
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                          }`}
                        >
                          {t.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => toggleTableActive(t.id, !t.active)}
                            className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-sm border transition-colors ${
                              t.active
                                ? 'border-border text-text-secondary hover:bg-neutral-100'
                                : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                            }`}
                          >
                            {t.active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => deleteTable(t.id)}
                            className="p-1.5 text-text-muted hover:text-red-600 transition-colors"
                            title="Delete table"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scannable QR Cards Preview Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-serif text-text-primary">Active Table QR Codes</h2>
            <p className="text-sm text-text-secondary">
              Live preview of table QR stand cards. Click Print to print cards.
            </p>
          </div>
          <button
            onClick={handlePrint}
            disabled={activeTablesList.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-white transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Cards
          </button>
        </div>

        {activeTablesList.length === 0 ? (
          <div className="bg-white border border-border rounded-sm p-8 text-center text-text-secondary">
            No active tables to generate QR codes for. Activate or add tables above.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTablesList.map((t) => {
              const url = getTableUrl(t.id);
              return (
                <div
                  key={t.id}
                  className="bg-white border border-border rounded-sm p-6 flex flex-col items-center text-center shadow-sm relative group hover:border-text-primary/40 transition-colors"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-1">
                    DineView Table Stand
                  </span>
                  <h3 className="text-xl font-serif text-text-primary mb-1">{t.name}</h3>
                  <span className="px-2.5 py-0.5 bg-border/40 text-text-primary font-mono text-xs font-bold rounded-sm mb-4">
                    {t.id}
                  </span>

                  <div className="p-3 bg-white border border-border/80 rounded-md shadow-inner mb-4">
                    <QRCodeSVG
                      value={url}
                      size={160}
                      level="H"
                      includeMargin={true}
                    />
                  </div>

                  <p className="text-xs text-text-secondary mb-4">
                    Scan with camera to browse menu & order
                  </p>

                  <div className="flex items-center gap-2 w-full pt-3 border-t border-border/50">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold uppercase tracking-wider border border-border rounded-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Test URL
                    </a>
                    <button
                      onClick={() => handleCopyLink(t.id)}
                      className="p-2 border border-border rounded-sm text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
                      title="Copy QR URL"
                    >
                      {copiedId === t.id ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden Print Section: Rendered only when printing via window.print() */}
      <div id="qr-print-area" className="hidden print:block">
        <div className="grid grid-cols-2 gap-6 p-4">
          {activeTablesList.map((t) => {
            const url = getTableUrl(t.id);
            return (
              <div
                key={`print-${t.id}`}
                className="border-2 border-dashed border-gray-400 p-8 rounded-lg flex flex-col items-center text-center bg-white page-break-inside-avoid"
                style={{ breakInside: 'avoid' }}
              >
                <div className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                  D I N E V I E W
                </div>
                <h2 className="text-2xl font-serif font-bold text-gray-900 mb-1">
                  {t.name}
                </h2>
                <div className="px-3 py-1 bg-gray-100 border border-gray-300 font-mono text-sm font-bold rounded mb-4">
                  Table {t.id}
                </div>

                <div className="p-3 bg-white border border-gray-200 rounded mb-4">
                  <QRCodeSVG
                    value={url}
                    size={180}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <p className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                  Scan to View Menu & Order
                </p>
                <p className="text-[10px] text-gray-400 font-mono">
                  {url}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
