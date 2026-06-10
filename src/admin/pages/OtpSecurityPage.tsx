import { useState, useEffect, useCallback } from 'react';
import { Shield, Ban, CheckCircle2, Trash2, Plus, RefreshCw, AlertTriangle, X, Users } from 'lucide-react';
import { toast } from 'sonner';
import { adminApiService } from '../../services/adminApi';

interface BlockedIp {
  ip: string;
  blocked_at: string;
  request_count: number;
  reason: string;
}

interface WhitelistedIp {
  ip: string;
  whitelisted_at: string;
  whitelisted_by: string;
  note: string;
}

type Tab = 'blocked' | 'whitelist';

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

export function OtpSecurityPage() {
  const [tab, setTab] = useState<Tab>('blocked');

  // Blocked IPs state
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [selectedIps, setSelectedIps] = useState<Set<string>>(new Set());
  const [unblocking, setUnblocking] = useState<string | null>(null);

  // Whitelist state
  const [whitelistedIps, setWhitelistedIps] = useState<WhitelistedIp[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Add to whitelist form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addingIp, setAddingIp] = useState(false);

  const fetchBlockedIps = useCallback(async () => {
    setBlockedLoading(true);
    try {
      const res = await adminApiService.getBlockedIps();
      if (res.status === 'success') {
        setBlockedIps((res.data as any)?.data ?? res.data ?? []);
      } else {
        toast.error(res.message || 'Failed to fetch blocked IPs');
      }
    } catch {
      toast.error('Failed to fetch blocked IPs');
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  const fetchWhitelistedIps = useCallback(async () => {
    setWhitelistLoading(true);
    try {
      const res = await adminApiService.getWhitelistedIps();
      if (res.status === 'success') {
        setWhitelistedIps((res.data as any)?.data ?? res.data ?? []);
      } else {
        toast.error(res.message || 'Failed to fetch whitelisted IPs');
      }
    } catch {
      toast.error('Failed to fetch whitelisted IPs');
    } finally {
      setWhitelistLoading(false);
    }
  }, []);

  useEffect(() => { fetchBlockedIps(); }, [fetchBlockedIps]);
  useEffect(() => { fetchWhitelistedIps(); }, [fetchWhitelistedIps]);

  // ── Blocked IP actions ────────────────────────────────────────────────────

  const handleUnblock = async (ip: string) => {
    setUnblocking(ip);
    try {
      const res = await adminApiService.unblockIp(ip);
      if (res.status === 'success') {
        toast.success(`IP ${ip} unblocked`);
        setBlockedIps(prev => prev.filter(b => b.ip !== ip));
        setSelectedIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
      } else {
        toast.error(res.message || 'Failed to unblock IP');
      }
    } catch {
      toast.error('Failed to unblock IP');
    } finally {
      setUnblocking(null);
    }
  };

  const handleUnblockSelected = async () => {
    if (selectedIps.size === 0) return;
    setUnblocking('bulk');
    try {
      const res = await adminApiService.unblockIps(Array.from(selectedIps));
      if (res.status === 'success') {
        toast.success(`${selectedIps.size} IP${selectedIps.size !== 1 ? 's' : ''} unblocked`);
        setBlockedIps(prev => prev.filter(b => !selectedIps.has(b.ip)));
        setSelectedIps(new Set());
      } else {
        toast.error(res.message || 'Failed to unblock IPs');
      }
    } catch {
      toast.error('Failed to unblock IPs');
    } finally {
      setUnblocking(null);
    }
  };

  const handleWhitelistFromBlock = async (ip: string) => {
    setUnblocking(ip);
    try {
      const res = await adminApiService.whitelistIp(ip, 'Whitelisted from blocked list');
      if (res.status === 'success') {
        toast.success(`IP ${ip} whitelisted and unblocked`);
        setBlockedIps(prev => prev.filter(b => b.ip !== ip));
        fetchWhitelistedIps();
      } else {
        toast.error(res.message || 'Failed to whitelist IP');
      }
    } catch {
      toast.error('Failed to whitelist IP');
    } finally {
      setUnblocking(null);
    }
  };

  const toggleSelect = (ip: string) => {
    setSelectedIps(prev => {
      const s = new Set(prev);
      s.has(ip) ? s.delete(ip) : s.add(ip);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIps.size === blockedIps.length) {
      setSelectedIps(new Set());
    } else {
      setSelectedIps(new Set(blockedIps.map(b => b.ip)));
    }
  };

  // ── Whitelist actions ─────────────────────────────────────────────────────

  const handleRemoveWhitelist = async (ip: string) => {
    setRemoving(ip);
    try {
      const res = await adminApiService.removeWhitelistedIp(ip);
      if (res.status === 'success') {
        toast.success(`IP ${ip} removed from whitelist`);
        setWhitelistedIps(prev => prev.filter(w => w.ip !== ip));
      } else {
        toast.error(res.message || 'Failed to remove IP');
      }
    } catch {
      toast.error('Failed to remove IP');
    } finally {
      setRemoving(null);
    }
  };

  const handleAddWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    const ip = newIp.trim();
    if (!ip) { toast.error('IP address is required'); return; }
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipv4.test(ip)) { toast.error('Enter a valid IPv4 address'); return; }

    setAddingIp(true);
    try {
      const res = await adminApiService.whitelistIp(ip, newNote.trim());
      if (res.status === 'success') {
        toast.success(`IP ${ip} added to whitelist`);
        setNewIp('');
        setNewNote('');
        setShowAddForm(false);
        fetchWhitelistedIps();
        setBlockedIps(prev => prev.filter(b => b.ip !== ip));
      } else {
        toast.error(res.message || 'Failed to whitelist IP');
      }
    } catch {
      toast.error('Failed to whitelist IP');
    } finally {
      setAddingIp(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">OTP Security</h1>
            <p className="text-sm text-gray-500">Manage IPs auto-blocked for OTP abuse</p>
          </div>
        </div>
        <button
          onClick={() => { fetchBlockedIps(); fetchWhitelistedIps(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg">
            <Ban className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-red-600 font-medium">Permanently Blocked</p>
            <p className="text-3xl font-bold text-red-700">{blockedIps.length}</p>
            <p className="text-xs text-red-500 mt-1">IPs require manual unblock</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-green-600 font-medium">Whitelisted IPs</p>
            <p className="text-3xl font-bold text-green-700">{whitelistedIps.length}</p>
            <p className="text-xs text-green-500 mt-1">Never blocked by auto-guard</p>
          </div>
        </div>
      </div>

      {/* Alert banner when blocked IPs exist */}
      {blockedIps.length > 0 && tab === 'blocked' && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{blockedIps.length} IP{blockedIps.length !== 1 ? 's' : ''}</span> permanently blocked after repeated OTP abuse.
            Review and unblock legitimate users below. Blocked IPs are rejected instantly on every OTP request.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {(['blocked', 'whitelist'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t === 'blocked' ? (
                <span className="flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Blocked IPs
                  {blockedIps.length > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {blockedIps.length}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Whitelist
                  {whitelistedIps.length > 0 && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {whitelistedIps.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── BLOCKED IPs tab ──────────────────────────────────────────────── */}
      {tab === 'blocked' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              {selectedIps.size > 0
                ? `${selectedIps.size} selected`
                : `${blockedIps.length} blocked IP${blockedIps.length !== 1 ? 's' : ''}`}
            </p>
            {selectedIps.size > 0 && (
              <button
                onClick={handleUnblockSelected}
                disabled={unblocking === 'bulk'}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                {unblocking === 'bulk' ? 'Unblocking…' : `Unblock ${selectedIps.size} selected`}
              </button>
            )}
          </div>

          {blockedLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading…
            </div>
          ) : blockedIps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
              <p className="text-sm font-medium text-gray-500">No blocked IPs — all clear</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIps.size === blockedIps.length && blockedIps.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Blocked At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requests</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {blockedIps.map(b => (
                    <tr key={b.ip} className={`hover:bg-gray-50 transition-colors ${selectedIps.has(b.ip) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIps.has(b.ip)}
                          onChange={() => toggleSelect(b.ip)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                          {b.ip}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(b.blocked_at)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-red-600">
                          <Users className="h-3.5 w-3.5" />
                          {b.request_count ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{b.reason || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUnblock(b.ip)}
                            disabled={!!unblocking}
                            title="Unblock this IP"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {unblocking === b.ip ? 'Unblocking…' : 'Unblock'}
                          </button>
                          <button
                            onClick={() => handleWhitelistFromBlock(b.ip)}
                            disabled={!!unblocking}
                            title="Unblock and add to whitelist"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Whitelist
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── WHITELIST tab ─────────────────────────────────────────────────── */}
      {tab === 'whitelist' && (
        <div className="space-y-4">
          {/* Add form */}
          {showAddForm ? (
            <form
              onSubmit={handleAddWhitelist}
              className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add IP to Whitelist
                </h3>
                <button type="button" onClick={() => setShowAddForm(false)}>
                  <X className="h-4 w-4 text-green-600 hover:text-green-800" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">IP Address <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={newIp}
                    onChange={e => setNewIp(e.target.value)}
                    placeholder="e.g. 103.21.244.0"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="e.g. Mumbai office, payment gateway"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={addingIp}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {addingIp ? 'Adding…' : 'Add to Whitelist'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Whitelist an IP
              </button>
            </div>
          )}

          {/* Whitelist table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                {whitelistedIps.length} whitelisted IP{whitelistedIps.length !== 1 ? 's' : ''} — these are never auto-blocked
              </p>
            </div>

            {whitelistLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading…
              </div>
            ) : whitelistedIps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
                <Shield className="h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-500">No whitelisted IPs yet</p>
                <p className="text-xs text-gray-400">Add your office or payment gateway IPs to prevent accidental blocks</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">IP Address</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Added By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Added At</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {whitelistedIps.map(w => (
                      <tr key={w.ip} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-gray-900 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                            {w.ip}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{w.note || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{w.whitelisted_by || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(w.whitelisted_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveWhitelist(w.ip)}
                            disabled={removing === w.ip}
                            title="Remove from whitelist"
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors ml-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {removing === w.ip ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
