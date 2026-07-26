import { useState, useEffect } from 'react';
import {
  X, Shield, Users, Database, Mail, Send,
  CheckCircle2, XCircle, Download, Upload, History, Baby
} from 'lucide-react';
import { api } from '../api';
import type { Buyer, Rate, RateHistory } from '../types';
import { fmtPKR } from '../utils/format';

interface Props {
  username: string | null;
  onClose: () => void;
}

export default function AdminPanel({ username, onClose }: Props) {
  const [section, setSection] = useState<'profile' | 'users' | 'backup' | 'email' | 'rates' | 'buyers'>('profile');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Rate state
  const [currentRate, setCurrentRate] = useState<Rate | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [newRate, setNewRate] = useState('');

  // Buyer state
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ name: '', phone: '', address: '', defaultRate: '', notes: '' });

  // User state
  const [viewerCreds, setViewerCreds] = useState({ username: '', password: '' });

  // Email state
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; to: string | null } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [rate, history, buyersList, email] = await Promise.all([
        api.getRate(),
        api.getRateHistory(),
        api.getBuyers(),
        api.getEmailStatus().catch(() => ({ configured: false, to: null })),
      ]);
      setCurrentRate(rate);
      setRateHistory(history);
      setBuyers(buyersList);
      setEmailStatus(email);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  }

  function flash(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  // Rate handlers
  async function handleUpdateRate() {
    if (!newRate) return;
    try {
      await api.updateRate(parseFloat(newRate));
      setNewRate('');
      await loadAll();
      flash('success', 'Milk rate updated');
    } catch (err: any) { flash('error', err.message); }
  }

  // Buyer handlers
  async function handleAddBuyer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.addBuyer({ ...newBuyer, defaultRate: newBuyer.defaultRate ? parseFloat(newBuyer.defaultRate) : undefined });
      setNewBuyer({ name: '', phone: '', address: '', defaultRate: '', notes: '' });
      setShowBuyerForm(false);
      await loadAll();
      flash('success', 'Buyer added');
    } catch (err: any) { flash('error', err.message); }
  }

  async function handleDeleteBuyer(id: string) {
    if (!confirm('Delete this buyer?')) return;
    try {
      await api.deleteBuyer(id);
      await loadAll();
      flash('success', 'Buyer deleted');
    } catch (err: any) { flash('error', err.message); }
  }

  // User handlers
  async function handleAddViewer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.addViewer(viewerCreds.username, viewerCreds.password);
      setViewerCreds({ username: '', password: '' });
      flash('success', 'Viewer account created');
    } catch (err: any) { flash('error', err.message); }
  }

  // Backup handlers
  async function handleBackup() {
    try {
      const data = await api.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      flash('success', 'Backup downloaded');
    } catch (err: any) { flash('error', 'Backup failed: ' + err.message); }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        await api.restoreBackup(data);
        await loadAll();
        flash('success', 'Data restored');
      } catch (err: any) { flash('error', 'Restore failed: ' + err.message); }
    };
    reader.readAsText(file);
  }

  // Email handler
  async function handleSendEmail() {
    setSendingEmail(true);
    try {
      await api.sendSummaryNow();
      flash('success', 'Summary email sent');
    } catch (err: any) { flash('error', 'Send failed: ' + err.message); }
    finally { setSendingEmail(false); }
  }

  const sections = [
    { id: 'profile', label: 'Profile', icon: Shield },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'rates', label: 'Milk Rate', icon: History },
    { id: 'buyers', label: 'Buyers', icon: Baby },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'email', label: 'Email', icon: Mail },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Admin Panel</h2>
              <p className="text-[10px] text-slate-400">Manage your farm settings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-slate-200 dark:border-slate-800 p-2 shrink-0 overflow-y-auto">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  section === s.id
                    ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Status flash */}
            {status && (
              <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
                status.type === 'success' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {status.msg}
              </div>
            )}

            {/* ── Profile ──────────────────────────── */}
            {section === 'profile' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Admin Profile</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-xl font-bold text-teal-700 dark:text-teal-400">
                      {(username || 'A')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{username}</p>
                      <p className="text-xs text-slate-400">Administrator</p>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>• You have full access to all farm features</p>
                  <p>• You can add/viewer accounts, manage buyers, rates, and backups</p>
                  <p>• Changes you make are saved automatically</p>
                </div>
              </div>
            )}

            {/* ── Users ────────────────────────────── */}
            {section === 'users' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">User Management</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Add Viewer Account</h4>
                  <p className="text-xs text-slate-400 mb-3">Viewers can see all data but cannot edit or delete anything.</p>
                  <form onSubmit={handleAddViewer} className="space-y-3">
                    <input
                      required
                      placeholder="Username"
                      value={viewerCreds.username}
                      onChange={e => setViewerCreds({ ...viewerCreds, username: e.target.value })}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none"
                    />
                    <input
                      required
                      type="password"
                      placeholder="Password"
                      value={viewerCreds.password}
                      onChange={e => setViewerCreds({ ...viewerCreds, password: e.target.value })}
                      className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none"
                    />
                    <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                      Create Viewer
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── Milk Rate ────────────────────────── */}
            {section === 'rates' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Milk Rate Management</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-400 uppercase mb-1">Current Rate</p>
                  <p className="text-3xl font-bold text-teal-600">{fmtPKR(currentRate?.value || 0)} <span className="text-sm font-normal text-slate-400">/ litre</span></p>
                  <div className="flex gap-2 mt-3">
                    <input
                      type="number"
                      value={newRate}
                      onChange={e => setNewRate(e.target.value)}
                      placeholder="New rate (₨)"
                      className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none"
                    />
                    <button onClick={handleUpdateRate} className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-2 text-sm font-medium">
                      Update
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Rate History</h4>
                  <div className="space-y-2">
                    {rateHistory.map(h => (
                      <div key={h._id} className="flex justify-between text-sm">
                        <span className="text-slate-500">{h.date}</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(h.value)}</span>
                      </div>
                    ))}
                    {rateHistory.length === 0 && <p className="text-xs text-slate-400">No history yet</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Buyers ───────────────────────────── */}
            {section === 'buyers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Buyers Management</h3>
                  <button
                    onClick={() => setShowBuyerForm(!showBuyerForm)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {showBuyerForm ? 'Cancel' : '+ Add Buyer'}
                  </button>
                </div>

                {showBuyerForm && (
                  <form onSubmit={handleAddBuyer} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
                    <input required placeholder="Name *" value={newBuyer.name} onChange={e => setNewBuyer({ ...newBuyer, name: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" />
                    <input placeholder="Phone" value={newBuyer.phone} onChange={e => setNewBuyer({ ...newBuyer, phone: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" />
                    <input type="number" placeholder="Default Rate" value={newBuyer.defaultRate} onChange={e => setNewBuyer({ ...newBuyer, defaultRate: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" />
                    <input placeholder="Address" value={newBuyer.address} onChange={e => setNewBuyer({ ...newBuyer, address: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" />
                    <button type="submit" className="w-full bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Add Buyer</button>
                  </form>
                )}

                <div className="space-y-2">
                  {buyers.map(b => (
                    <div key={b._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{b.name}</p>
                        <p className="text-xs text-slate-400">{b.phone || '-'} · {b.defaultRate ? `₨${b.defaultRate}/L` : 'Global rate'}</p>
                      </div>
                      <button onClick={() => handleDeleteBuyer(b._id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    </div>
                  ))}
                  {buyers.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No buyers yet</p>}
                </div>
              </div>
            )}

            {/* ── Backup ───────────────────────────── */}
            {section === 'backup' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Backup & Restore</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleBackup}
                    className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-6 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download className="w-8 h-8 text-teal-600" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Download Backup</p>
                    <p className="text-[10px] text-slate-400">All data as .json file</p>
                  </button>
                  <div className="relative">
                    <input type="file" accept=".json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                    <div className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-6 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors h-full">
                      <Upload className="w-8 h-8 text-purple-600" />
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Restore from JSON</p>
                      <p className="text-[10px] text-red-400">⚠️ Overwrites all data</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Email ────────────────────────────── */}
            {section === 'email' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Daily Email Summary</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {emailStatus?.configured ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          Configured — sending to <span className="font-medium">{emailStatus.to}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Not configured — add email settings in Replit Secrets</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleSendEmail}
                    disabled={!emailStatus?.configured || sendingEmail}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    {sendingEmail ? 'Sending...' : "Send Today's Summary Now"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
