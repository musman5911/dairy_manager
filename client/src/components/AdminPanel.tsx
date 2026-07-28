import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  X, Shield, Users, Database, Mail, Send, CheckCircle2, XCircle,
  Download, Upload, History, Baby, Settings, UserPlus, Trash2,
  KeyRound, ShieldCheck, UserRound, Check, AlertCircle, Power,
} from 'lucide-react';
import { api } from '../api';
import type { AuthUser, Buyer, Rate, RateHistory, UserRole } from '../types';
import { fmtPKR } from '../utils/format';

interface Props {
  username: string | null;
  onClose: () => void;
}

type Section = 'profile' | 'users' | 'rates' | 'buyers' | 'backup' | 'email';

type Status = { type: 'success' | 'error'; msg: string } | null;

const inputClass = 'w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition';

export default function AdminPanel({ username, onClose }: Props) {
  const [section, setSection] = useState<Section>('profile');
  const [status, setStatus] = useState<Status>(null);

  // Rate state
  const [currentRate, setCurrentRate] = useState<Rate | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [newRate, setNewRate] = useState('');

  // Buyer state
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [showBuyerForm, setShowBuyerForm] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ name: '', phone: '', address: '', defaultRate: '', notes: '' });

  // User state
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'worker' as UserRole, displayName: '', email: '' });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  // Email state
  const [emailStatus, setEmailStatus] = useState<{ configured: boolean; to: string | null } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const currentUser = users.find((user) => user.username === username) || null;

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadAll() {
    try {
      const [rate, history, buyersList, email, userList] = await Promise.all([
        api.getRate(),
        api.getRateHistory(),
        api.getBuyers(),
        api.getEmailStatus().catch(() => ({ configured: false, to: null })),
        api.listUsers().catch(() => []),
      ]);
      setCurrentRate(rate);
      setRateHistory(history);
      setBuyers(buyersList);
      setEmailStatus(email);
      setUsers(userList);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  }

  function flash(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleUpdateRate() {
    if (!newRate) return;
    try {
      await api.updateRate(parseFloat(newRate));
      setNewRate('');
      await loadAll();
      flash('success', 'Milk rate updated');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update milk rate');
    }
  }

  async function handleAddBuyer(event: FormEvent) {
    event.preventDefault();
    try {
      await api.addBuyer({ ...newBuyer, defaultRate: newBuyer.defaultRate ? parseFloat(newBuyer.defaultRate) : undefined });
      setNewBuyer({ name: '', phone: '', address: '', defaultRate: '', notes: '' });
      setShowBuyerForm(false);
      await loadAll();
      flash('success', 'Buyer added');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not add buyer');
    }
  }

  async function handleDeleteBuyer(id: string) {
    if (!confirm('Delete this buyer?')) return;
    try {
      await api.deleteBuyer(id);
      await loadAll();
      flash('success', 'Buyer deleted');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not delete buyer');
    }
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    try {
      await api.createUser({
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
        displayName: newUser.displayName,
        email: newUser.email,
      });
      setNewUser({ username: '', password: '', role: 'worker', displayName: '', email: '' });
      setShowUserForm(false);
      await loadUsers();
      flash('success', `${newUser.role === 'admin' ? 'Admin' : 'Worker'} account created`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not create user');
    }
  }

  async function toggleRole(user: AuthUser) {
    if (user.username === username) {
      flash('error', "You can't change your own role");
      return;
    }
    const nextRole: UserRole = user.role === 'admin' ? 'worker' : 'admin';
    try {
      await api.updateUser(user._id, { role: nextRole });
      await loadUsers();
      flash('success', `${user.username} is now ${nextRole}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update role');
    }
  }

  async function toggleActive(user: AuthUser) {
    if (user.username === username) {
      flash('error', "You can't deactivate yourself");
      return;
    }
    try {
      await api.updateUser(user._id, { active: !user.active });
      await loadUsers();
      flash('success', `${user.username} ${!user.active ? 'activated' : 'deactivated'}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update account');
    }
  }

  async function resetUserPassword(user: AuthUser) {
    const password = prompt(`Set a new password for ${user.username}:`);
    if (!password) return;
    if (password.length < 4) {
      flash('error', 'Password must be at least 4 characters');
      return;
    }
    try {
      await api.updateUser(user._id, { password });
      flash('success', `Password reset for ${user.username}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not reset password');
    }
  }

  async function editUserEmail(user: AuthUser) {
    const email = prompt(`Set email for ${user.username} (leave blank to remove):`, user.email || '');
    if (email === null) return;
    try {
      await api.updateUser(user._id, { email: email.trim().toLowerCase() });
      await loadUsers();
      flash('success', `Email updated for ${user.username}`);
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not update email');
    }
  }

  async function handleDeleteUser(user: AuthUser) {
    if (user.username === username) return;
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(user._id);
      await loadUsers();
      flash('success', 'User deleted');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not delete user');
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      flash('error', 'Fill current and new password');
      return;
    }
    setPasswordBusy(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      flash('success', 'Password changed');
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleBackup() {
    try {
      const data = await api.getBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dairy_backup_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      flash('success', 'Backup downloaded');
    } catch (err) {
      flash('error', err instanceof Error ? `Backup failed: ${err.message}` : 'Backup failed');
    }
  }

  async function handleRestore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const data = JSON.parse(String(loadEvent.target?.result || '{}'));
        await api.restoreBackup(data);
        await loadAll();
        flash('success', 'Data restored');
      } catch (err) {
        flash('error', err instanceof Error ? `Restore failed: ${err.message}` : 'Restore failed');
      }
    };
    reader.readAsText(file);
  }

  async function handleSendEmail() {
    setSendingEmail(true);
    try {
      await api.sendSummaryNow();
      flash('success', 'Summary email sent');
    } catch (err) {
      flash('error', err instanceof Error ? `Send failed: ${err.message}` : 'Send failed');
    } finally {
      setSendingEmail(false);
    }
  }

  const sections = [
    { id: 'profile', label: 'General', icon: Settings },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'rates', label: 'Milk Rate', icon: History },
    { id: 'buyers', label: 'Buyers', icon: Baby },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'email', label: 'Email', icon: Mail },
  ] as const;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[9999] flex items-center justify-center p-2 sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in" style={{ width: '100vw', height: '100vh' }} onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[94vh] sm:max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-800 dark:via-slate-900 dark:to-emerald-950/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 animate-pop-in shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold font-display text-slate-900 dark:text-slate-50 truncate">Admin Panel</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {username || 'Admin'} · admin control center
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-white/80 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition hover:rotate-90">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-2 sm:px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 overflow-x-auto no-scrollbar shrink-0">
          {sections.map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSection(tab.id)}
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {active && <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full animate-tab-pill" />}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div key={section} className="flex-1 overflow-y-auto p-4 sm:p-6 animate-tab-in">
          {status && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
              status.type === 'success'
                ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {status.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {status.msg}
            </div>
          )}

          {section === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="dm-card p-5">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Admin Profile</h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900/40 dark:to-emerald-900/40 rounded-2xl flex items-center justify-center text-2xl font-bold text-teal-700 dark:text-teal-300">
                    {(username || 'A')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100">{username}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Administrator account</p>
                    {currentUser?.email && <p className="text-xs font-mono text-slate-400 mt-1">{currentUser.email}</p>}
                  </div>
                </div>
                <div className="mt-5 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <p>• Admins can create worker accounts and manage all records.</p>
                  <p>• Workers can sign in and view day-to-day farm data.</p>
                  <p>• Use backups before major data changes.</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="dm-card p-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-teal-600" /> Change my password
                </h3>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                  className={inputClass}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password (min 4 characters)"
                  className={inputClass}
                />
                <button type="submit" disabled={passwordBusy} className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
                  {passwordBusy ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {section === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">User Management</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Create admin and worker accounts for your farm team.</p>
                </div>
                <button onClick={() => setShowUserForm((value) => !value)} className="shrink-0 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition">
                  <UserPlus className="w-4 h-4" /> {showUserForm ? 'Cancel' : 'New User'}
                </button>
              </div>

              {showUserForm && (
                <form onSubmit={handleCreateUser} className="dm-card p-4 space-y-3 animate-slide-up">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input required value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} placeholder="Username" className={inputClass} />
                    <input required type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="Password" className={inputClass} />
                    <input value={newUser.displayName} onChange={(event) => setNewUser({ ...newUser, displayName: event.target.value })} placeholder="Display name (optional)" className={inputClass} />
                    <select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value as UserRole })} className={inputClass}>
                      <option value="worker">Worker</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} placeholder="Email (optional)" className="sm:col-span-2 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition" />
                  </div>
                  <button type="submit" className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
                    Create {newUser.role === 'admin' ? 'Admin' : 'Worker'}
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {usersLoading ? (
                  <div className="text-sm text-slate-500 py-8 text-center">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="text-sm text-slate-500 py-8 text-center">No users found.</div>
                ) : (
                  users.map((user) => (
                    <div key={user._id} className={`dm-card p-3 flex flex-wrap items-center justify-between gap-3 ${user.active ? '' : 'opacity-60'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                          {user.role === 'admin' ? <Shield className="w-4 h-4" /> : <UserRound className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono truncate">{user.username}</span>
                            {user.username === username && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">you</span>}
                            {!user.active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">inactive</span>}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {user.displayName || 'No display name'} · {user.role === 'admin' ? 'Admin' : 'Worker'}
                            {user.email ? ` · ${user.email}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button onClick={() => toggleRole(user)} disabled={user.username === username} title={user.role === 'admin' ? 'Make worker' : 'Make admin'} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition">
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button onClick={() => resetUserPassword(user)} title="Reset password" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition">
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button onClick={() => editUserEmail(user)} title="Edit reset email" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition">
                          <Mail className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleActive(user)} disabled={user.username === username} title={user.active ? 'Deactivate' : 'Activate'} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 transition">
                          <Power className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(user)} disabled={user.username === username} title="Delete user" className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 disabled:opacity-30 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {section === 'rates' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="dm-card p-5">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Milk Rate Management</h3>
                <p className="text-xs text-slate-400 uppercase mb-1">Current Rate</p>
                <p className="text-3xl font-bold text-teal-600">{fmtPKR(currentRate?.value || 0)} <span className="text-sm font-normal text-slate-400">/ litre</span></p>
                <div className="flex gap-2 mt-4">
                  <input type="number" value={newRate} onChange={(event) => setNewRate(event.target.value)} placeholder="New rate (₨)" className={inputClass} />
                  <button onClick={handleUpdateRate} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 text-sm font-semibold transition">Update</button>
                </div>
              </div>
              <div className="dm-card p-5 max-h-[320px] overflow-y-auto">
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Rate History</h4>
                <div className="space-y-2">
                  {rateHistory.map((history) => (
                    <div key={history._id} className="flex justify-between text-sm border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-slate-500">{history.date}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(history.value)}</span>
                    </div>
                  ))}
                  {rateHistory.length === 0 && <p className="text-xs text-slate-400">No history yet</p>}
                </div>
              </div>
            </div>
          )}

          {section === 'buyers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Buyers Management</h3>
                <button onClick={() => setShowBuyerForm(!showBuyerForm)} className="text-xs text-teal-600 hover:text-teal-700 font-semibold transition">
                  {showBuyerForm ? 'Cancel' : '+ Add Buyer'}
                </button>
              </div>

              {showBuyerForm && (
                <form onSubmit={handleAddBuyer} className="dm-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slide-up">
                  <input required placeholder="Name *" value={newBuyer.name} onChange={(event) => setNewBuyer({ ...newBuyer, name: event.target.value })} className={inputClass} />
                  <input placeholder="Phone" value={newBuyer.phone} onChange={(event) => setNewBuyer({ ...newBuyer, phone: event.target.value })} className={inputClass} />
                  <input type="number" placeholder="Default Rate" value={newBuyer.defaultRate} onChange={(event) => setNewBuyer({ ...newBuyer, defaultRate: event.target.value })} className={inputClass} />
                  <input placeholder="Address" value={newBuyer.address} onChange={(event) => setNewBuyer({ ...newBuyer, address: event.target.value })} className={inputClass} />
                  <input placeholder="Notes" value={newBuyer.notes} onChange={(event) => setNewBuyer({ ...newBuyer, notes: event.target.value })} className="sm:col-span-2 w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition" />
                  <button type="submit" className="sm:col-span-2 bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition hover:bg-teal-700">Add Buyer</button>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {buyers.map((buyer) => (
                  <div key={buyer._id} className="dm-card p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{buyer.name}</p>
                      <p className="text-xs text-slate-400">{buyer.phone || '-'} · {buyer.defaultRate ? `₨${buyer.defaultRate}/L` : 'Global rate'}</p>
                    </div>
                    <button onClick={() => handleDeleteBuyer(buyer._id)} className="text-red-400 hover:text-red-600 text-xs font-semibold transition">Delete</button>
                  </div>
                ))}
                {buyers.length === 0 && <p className="text-xs text-slate-400 text-center py-4 md:col-span-2">No buyers yet</p>}
              </div>
            </div>
          )}

          {section === 'backup' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Backup & Restore</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={handleBackup} className="dm-card p-6 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <Download className="w-8 h-8 text-teal-600" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Download Backup</p>
                  <p className="text-[10px] text-slate-400">All data as .json file</p>
                </button>
                <div className="relative">
                  <input type="file" accept=".json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="dm-card p-6 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition h-full">
                    <Upload className="w-8 h-8 text-purple-600" />
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Restore from JSON</p>
                    <p className="text-[10px] text-red-400">⚠️ Overwrites all data</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'email' && (
            <div className="space-y-4 max-w-xl">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Daily Email Summary</h3>
              <div className="dm-card p-5">
                <div className="flex items-start gap-2 mb-4">
                  {emailStatus?.configured ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Configured — sending to <span className="font-medium">{emailStatus.to}</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-amber-500 shrink-0" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">Not configured — add email settings in your environment variables.</span>
                    </>
                  )}
                </div>
                <button onClick={handleSendEmail} disabled={!emailStatus?.configured || sendingEmail} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition">
                  <Send className="w-4 h-4" />
                  {sendingEmail ? 'Sending...' : "Send Today's Summary Now"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
