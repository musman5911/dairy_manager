import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Droplets,
  DollarSign, Hash, AlertCircle, Heart, X, History, PieChart as PieChartIcon, CalendarDays,
  ArrowRight, Eye,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import { api } from '../api';
import { Cow, MilkEntry, Expense, HealthRecord, Rate, RateHistory } from '../types';
import { fmt, fmtPKR } from '../utils/format';
import { calcRevenueWithHistory } from '../utils/rates';
import { todayStr as getTodayStr, shiftDate } from '../utils/date';
import { cardSpring, wobbleSpring, staggerDelay, prefersReducedMotion } from '../motion';
import CowDetailPopup from './CowDetailPopup';
import ViewportModal from './ViewportModal';

interface DashboardProps {
  isAdmin: boolean;
  onNavigate: (tab: string) => void;
}

function CowImg({ src, name, size = 'w-8 h-8' }: { src?: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`${size} rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm shrink-0`}>🐄</div>;
  }
  return <img src={src} alt={name} crossOrigin="anonymous" className={`${size} rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0`} onError={() => setBroken(true)} />;
}

function genderLabel(cow: Cow) {
  return cow.gender === 'male' ? '🐂' : '🐄';
}

export default function Dashboard({ isAdmin: _isAdmin, onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [showMilkPopup, setShowMilkPopup] = useState(false);
  const [showRatePopup, setShowRatePopup] = useState(false);
  const [showPnlPopup, setShowPnlPopup] = useState(false);
  const [showTopPopup, setShowTopPopup] = useState(false);
  const [showAlertsPopup, setShowAlertsPopup] = useState(false);
  const [cowFilter, setCowFilter] = useState<string>('all');
  const [rangeTo, setRangeTo] = useState(getTodayStr());
  const [rangeFrom, setRangeFrom] = useState(() => `${getTodayStr().slice(0, 8)}01`);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(rangeFrom);
  const [customTo, setCustomTo] = useState(rangeTo);
  const [data, setData] = useState<{
    cows: Cow[];
    milk: MilkEntry[];
    expenses: Expense[];
    rate: Rate | null;
    healthAlerts: HealthRecord[];
    allHealth: HealthRecord[];
    todayMilk: MilkEntry[];
    todayExpenses: Expense[];
  }>({ cows: [], milk: [], expenses: [], rate: null, healthAlerts: [], allHealth: [], todayMilk: [], todayExpenses: [] });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const today = getTodayStr();
        const [cows, milk, expenses, rate, healthAlerts, rateHist, allHealth, todayMilk, todayExpenses] = await Promise.all([
          api.getCows(),
          api.getMilk({ from: rangeFrom, to: rangeTo }),
          api.getExpenses({ from: rangeFrom, to: rangeTo }),
          api.getRate(),
          api.getUpcomingHealth(),
          api.getRateHistory(),
          api.getHealth(),
          api.getMilk({ from: today, to: today }),
          api.getExpenses({ from: today, to: today }),
        ]);
        setData({ cows, milk, expenses, rate, healthAlerts, allHealth, todayMilk, todayExpenses });
        setRateHistory(rateHist);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [rangeFrom, rangeTo]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  const todayStr = getTodayStr();
  const monthStart = `${todayStr.slice(0, 8)}01`;
  const isCurrentMonthRange = rangeFrom === monthStart && rangeTo === todayStr;
  const rangeLabel = `${rangeFrom} → ${rangeTo}`;
  const rangeDays = Math.max(1, Math.round((new Date(`${rangeTo}T00:00:00`).getTime() - new Date(`${rangeFrom}T00:00:00`).getTime()) / 86400000) + 1);
  const selectThisMonth = () => {
    setRangeFrom(monthStart);
    setRangeTo(todayStr);
    setCustomOpen(false);
  };
  const openCustomRange = () => {
    setCustomFrom(rangeFrom);
    setCustomTo(rangeTo);
    setCustomOpen(true);
  };
  const applyCustomRange = () => {
    if (!customFrom || !customTo || customFrom > customTo) return;
    setRangeFrom(customFrom);
    setRangeTo(customTo);
    setCustomOpen(false);
  };
  const yesterdayStr = shiftDate(todayStr, -1);

  const todayMilk = Math.round(data.todayMilk.reduce((a, c) => a + c.morning + c.evening, 0) * 100) / 100;
  const rangeMilkEntries = data.milk.filter(m => m.date >= rangeFrom && m.date <= rangeTo);
  const rangeTotalMilk = Math.round(rangeMilkEntries.reduce((a, c) => a + (c.morning || 0) + (c.evening || 0), 0) * 100) / 100;
  const rangeRevenue = calcRevenueWithHistory(rangeMilkEntries, rateHistory, data.rate?.value || 0, data.rate?.date || '');
  const rangeExpenses = data.expenses.filter(e => e.date >= rangeFrom && e.date <= rangeTo).reduce((a, c) => a + c.amount, 0);
  const profitLoss = rangeRevenue - rangeExpenses;

  // Top 3 producers in selected range
  const cowMilkMap: Record<string, number> = {};
  rangeMilkEntries.forEach(m => { cowMilkMap[m.cowId] = (cowMilkMap[m.cowId] || 0) + m.morning + m.evening; });
  const topProducers = Object.entries(cowMilkMap)
    .map(([id, milk]) => ({ cow: data.cows.find(c => c._id === id), milk }))
    .filter(p => p.cow)
    .sort((a, b) => b.milk - a.milk)
    .slice(0, 3);

  // Milk by cow in selected range
  const rangeMilkByCow = data.cows
    .map(cow => {
      const entries = rangeMilkEntries.filter(m => m.cowId === cow._id);
      const morning = entries.reduce((a, m) => a + (m.morning || 0), 0);
      const evening = entries.reduce((a, m) => a + (m.evening || 0), 0);
      const calfMilk = entries.reduce((a, m) => a + (m.calfMilk || 0), 0);
      return { cow, morning, evening, calfMilk, total: morning + evening, saleable: Math.max(0, morning + evening - calfMilk) };
    })
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total);

  // Today's expense/revenue data
  const todayExpenses = data.todayExpenses;
  const todayMilkRev = Math.round(calcRevenueWithHistory(data.todayMilk, rateHistory, data.rate?.value || 0, data.rate?.date || ''));
  const todayPurchases = todayExpenses.filter(e => e.type === 'purchasing').reduce((a, e) => a + e.amount, 0);
  const expByType: { name: string; value: number; color: string }[] = [];
  const todayExpByType: Record<string, number> = {};
  todayExpenses.forEach(e => { todayExpByType[e.type] = (todayExpByType[e.type] || 0) + e.amount; });
  const expColors: Record<string, string> = { feed: '#3b82f6', medicine: '#ef4444', labor: '#a855f7', equipment: '#f97316', purchasing: '#d97706', misc: '#64748b' };
  Object.entries(todayExpByType).forEach(([k, v]) => {
    if (v > 0) expByType.push({ name: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: expColors[k] || '#94a3b8' });
  });
  const todayTotalExp = todayExpenses.reduce((a, e) => a + e.amount, 0);
  const todayNet = todayMilkRev - todayTotalExp;

  // Recent Activity
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
  const recentActivity: { time: string; icon: string; text: string; color: string }[] = [];
  const todayMilkEntries = data.todayMilk;
  if (todayMilkEntries.length > 0) {
    const totalL = todayMilkEntries.reduce((a, m) => a + m.morning + m.evening, 0);
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '🥛', text: `Milk logged: ${fmt(totalL)}L for ${todayMilkEntries.length} cows`, color: 'text-teal-600' });
  }
  if (todayExpenses.length > 0) {
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '💰', text: `${todayExpenses.length} expenses added — ${fmtPKR(todayTotalExp)}`, color: 'text-red-600' });
  }
  const todayHealth = data.allHealth.filter(h => h.date === todayStr);
  if (todayHealth.length > 0) {
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '💊', text: `${todayHealth.length} health record(s) added`, color: 'text-amber-600' });
  }
  const yesterdayMilkEntries = data.milk.filter(m => m.date === yesterdayStr);
  if (yesterdayMilkEntries.length > 0) {
    const yTotal = yesterdayMilkEntries.reduce((a, m) => a + m.morning + m.evening, 0);
    recentActivity.push({ time: yesterdayStr, icon: '🥛', text: `Yesterday: ${fmt(yTotal)}L milk`, color: 'text-slate-500' });
  }
  if (data.healthAlerts.length > 0) {
    recentActivity.push({ time: `${todayStr} ${timeStr}`, icon: '⚠️', text: `${data.healthAlerts.length} health alert(s) due/overdue`, color: 'text-amber-600' });
  }
  if (topProducers.length > 0) {
    recentActivity.push({ time: rangeLabel, icon: '🏆', text: `Top producer: ${topProducers[0].cow!.name} — ${fmt(topProducers[0].milk)}L in selected range`, color: 'text-teal-600' });
  }

  // Cow filter
  const cowCount = data.cows.filter(c => c.gender !== 'male').length;
  const bullCount = data.cows.filter(c => c.gender === 'male').length;

  const filterButtons = [
    { key: 'all', label: 'All', count: data.cows.length },
    { key: 'cows', label: '🐄 Cows', count: cowCount },
    { key: 'bulls', label: '🐂 Bulls', count: bullCount },
    { key: 'active', label: 'Active', count: data.cows.filter(c => c.status === 'active').length },
    { key: 'dry', label: 'Dry', count: data.cows.filter(c => c.status === 'dry').length },
    { key: 'pregnant', label: 'Pregnant', count: data.cows.filter(c => c.status === 'pregnant').length },
    { key: 'calf', label: 'Calves', count: data.cows.filter(c => c.status === 'calf').length },
    { key: 'sold', label: 'Sold', count: data.cows.filter(c => c.status === 'sold').length },
  ];

  const filteredCows = data.cows.filter(cow => {
    if (cowFilter === 'all') return true;
    if (cowFilter === 'cows') return cow.gender !== 'male';
    if (cowFilter === 'bulls') return cow.gender === 'male';
    return cow.status === cowFilter;
  }).sort((a, b) => {
    // Sort: active first, then by milk today
    const aMilk = data.todayMilk.find(m => m.cowId === a._id && m.date === todayStr);
    const bMilk = data.todayMilk.find(m => m.cowId === b._id && m.date === todayStr);
    const aTotal = aMilk ? aMilk.morning + aMilk.evening : 0;
    const bTotal = bMilk ? bMilk.morning + bMilk.evening : 0;
    return bTotal - aTotal;
  });

  return (
    <div className="space-y-6 tab-panel">
      <div className="relative z-20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-3 sm:p-4 shadow-sm backdrop-blur">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Range</p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{rangeLabel}</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={selectThisMonth}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              isCurrentMonthRange
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={openCustomRange}
            title="Custom range"
            className={`p-1.5 rounded-lg border transition ${
              !isCurrentMonthRange
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
          </button>

          <AnimatePresence>
          {customOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0, y: -4 }}
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
            >
            <div className="p-4 space-y-3">
              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">Custom Range</h4>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">From</span>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg font-mono" />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">To</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded-lg font-mono" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setCustomOpen(false)} className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">Cancel</button>
                <button type="button" onClick={applyCustomRange} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Apply</button>
              </div>
            </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Health Alerts Banner ──────────────── */}
      {data.healthAlerts.length > 0 && (
        <motion.button
          initial={prefersReducedMotion() ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => setShowAlertsPopup(true)}
          className="group w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-3 hover:bg-amber-100/60 dark:hover:bg-amber-900/20 transition-colors duration-200 text-left">
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {data.healthAlerts.length} Health Alert{data.healthAlerts.length > 1 ? 's' : ''} — Click to view
            </p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 truncate">
              {data.healthAlerts.slice(0, 3).map(a => {
                const cow = data.cows.find(c => c._id === a.cowId);
                return cow ? `${genderLabel(cow)} ${cow.name}` : 'Unknown';
              }).join(', ')}
              {data.healthAlerts.length > 3 && ` +${data.healthAlerts.length - 3} more`}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-500 shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </motion.button>
      )}

      {/* ── Stats Cards ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem index={0}>
          <button onClick={() => document.getElementById('cow-table')?.scrollIntoView({ behavior: 'smooth' })} className="text-left w-full">
            <StatCard label="Cows & Bulls" value={String(data.cows.length)} icon={Hash}
              subText={`🐄 ${cowCount} Cows · 🐂 ${bullCount} Bulls`} />
          </button>
        </StaggerItem>
        <StaggerItem index={1}>
          <button onClick={() => setShowMilkPopup(true)} className="text-left w-full">
            <StatCard label="Milk" value={`${fmt(rangeTotalMilk)}L`} icon={Droplets} subText={rangeLabel} />
          </button>
        </StaggerItem>
        <StaggerItem index={2}>
          <button onClick={() => setShowPnlPopup(true)} className="text-left w-full">
            <StatCard label="Range P&L" value={fmtPKR(profitLoss)} icon={DollarSign}
              subText={`Rev: ${fmtPKR(rangeRevenue)}`} isNegative={profitLoss < 0} isProfit={profitLoss >= 0} />
          </button>
        </StaggerItem>
        <StaggerItem index={3}>
          <button onClick={() => setShowRatePopup(true)} className="text-left w-full">
            <StatCard label="Rate" value={`₨ ${data.rate?.value || 0}`} icon={DollarSign} subText="/ Litre" />
          </button>
        </StaggerItem>
      </div>

      {/* ── Today's Summary + Expenses ─────────── */}
      {(todayTotalExp > 0 || todayMilkRev > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-slate-400" />
              Today's Expenses
            </h3>
            <p className="text-[10px] text-slate-400 mb-3">{todayStr}</p>
            {expByType.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="w-32 h-32" style={{ outline: 'none', userSelect: 'none' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expByType} dataKey="value" cx="50%" cy="50%"
                        outerRadius={50} innerRadius={25}
                        isAnimationActive={false}
                        stroke="none"
                        strokeWidth={0}>
                        {expByType.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtPKR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {expByType.map(e => (
                    <div key={e.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                        {e.name}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(e.value)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1 flex justify-between font-bold text-xs">
                    <span>Total</span>
                    <span className="text-red-600">{fmtPKR(todayTotalExp)}</span>
                  </div>
                </div>
              </div>
            ) : <p className="text-xs text-slate-400">No expenses today</p>}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Today's Summary</h3>
            <p className="text-[10px] text-slate-400 mb-3">{todayStr}</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-teal-50 dark:bg-teal-900/10 rounded-lg">
                <span className="text-xs text-teal-700 dark:text-teal-400">Total Milk</span>
                <span className="text-sm font-bold text-teal-700 dark:text-teal-400">{fmt(todayMilk)} L</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Milk Revenue</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmtPKR(todayMilkRev)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                <span className="text-xs text-red-700 dark:text-red-400">Total Expenses</span>
                <span className="text-sm font-bold text-red-700 dark:text-red-400">{fmtPKR(todayTotalExp)}</span>
              </div>
              {todayPurchases > 0 && (
                <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                  <span className="text-xs text-amber-700 dark:text-amber-400">Animal Purchases</span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmtPKR(todayPurchases)}</span>
                </div>
              )}
              <div className={`flex justify-between items-center p-3 rounded-lg ${todayNet >= 0 ? 'bg-teal-50 dark:bg-teal-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                <span className={`text-xs font-medium ${todayNet >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}>Net Today</span>
                <span className={`text-lg font-bold ${todayNet >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}>{fmtPKR(todayNet)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cows & Bulls Table ─────────────────── */}
      <div id="cow-table" className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cows & Bulls</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Click an animal to see details</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map(btn => (
              <button key={btn.key} onClick={() => setCowFilter(btn.key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-200 ${
                  cowFilter === btn.key
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-teal-300 hover:shadow-sm'
                }`}>
                {btn.label} <span className="opacity-60">{btn.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Breed</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Today's Milk</th>
                <th className="px-4 py-3 text-right">Today's Expense</th>
                <th className="px-4 py-3 text-center">Health Today</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredCows.map(cow => {
                const todayMilkEntry = data.todayMilk.find(m => m.cowId === cow._id && m.date === todayStr);
                const totalToday = todayMilkEntry ? (todayMilkEntry.morning + todayMilkEntry.evening) : 0;
                const todayExp = data.todayExpenses.filter(e => e.cowId === cow._id && e.date === todayStr).reduce((a, e) => a + e.amount, 0);
                const todayHealth = data.allHealth.filter(h => h.cowId === cow._id && h.date === todayStr);
                const isMale = cow.gender === 'male';
                const statusColor = cow.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400' :
                  cow.status === 'dry' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400' :
                  cow.status === 'pregnant' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400' :
                  cow.status === 'sold' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400' :
                  cow.status === 'calf' ? 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400' :
                  'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400';
                return (
                  <tr key={cow._id}
                    className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 cursor-pointer transition-colors duration-150"
                    onClick={() => setSelectedCowId(cow._id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CowImg src={cow.image} name={cow.name} />
                        <div>
                          <span className="font-medium text-stone-800 dark:text-stone-200">{cow.name}</span>
                          {cow.isCalf && <span className="ml-1 text-[10px] text-pink-500">(calf)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{cow.breed}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        isMale ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                               : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                      }`}>
                        {isMale ? '🐂 Bull' : '🐄 Cow'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}>{cow.status.charAt(0).toUpperCase() + cow.status.slice(1)}</span></td>
                    <td className="px-4 py-3 text-right font-medium text-teal-600 dark:text-teal-400 text-xs">{totalToday > 0 ? `${fmt(totalToday)}L` : (isMale ? '-' : '-')}</td>
                    <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400 text-xs font-bold">{todayExp > 0 ? fmtPKR(todayExp) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {todayHealth.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600"><Heart className="w-3 h-3" />{todayHealth.length}</span>
                      ) : <span className="text-slate-300">-</span>}
                    </td>
                  </tr>
                );
              })}
              {filteredCows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs italic">No animals found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Recent Activity + Top Producers ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? recentActivity.map((a, i) => (
              <StaggerItem key={i} index={i}>
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg transition-colors duration-200">
                  <span className="text-base shrink-0">{a.icon}</span>
                  <p className={`text-xs font-medium ${a.color} flex-1`}>{a.text}</p>
                  {a.time && <span className="text-[10px] text-slate-400 shrink-0">{a.time}</span>}
                </div>
              </StaggerItem>
            )) : (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <button onClick={() => setShowTopPopup(true)} className="w-full text-left">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Top Producers <span className="text-[10px] text-slate-400 font-normal">(click for details)</span></h3>
            <div className="space-y-3">
              {topProducers.map((p, i) => (
                <div key={p.cow!._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-300 dark:text-slate-600 w-6">#{i + 1}</span>
                    <CowImg src={p.cow!.image} name={p.cow!.name} size="w-8 h-8" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{genderLabel(p.cow!)} {p.cow!.name}</p>
                      <p className="text-[10px] text-slate-400">{p.cow!.breed}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-teal-600">{fmt(p.milk)}L</p>
                </div>
              ))}
              {topProducers.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No milk data in this range</p>}
            </div>
          </button>
        </div>
      </div>

      {/* ── Popups ──────────────────────────────── */}
      <AnimatePresence>
      {selectedCowId && <CowDetailPopup key="cow-detail" cowId={selectedCowId} rate={data.rate?.value || 0} rateHistory={rateHistory} rateDate={data.rate?.date || ''} onClose={() => setSelectedCowId(null)} />}

      {showAlertsPopup && (
        <Popup key="alerts" title={`Health Alerts (${data.healthAlerts.length})`} rangeLabel={rangeLabel} onClose={() => setShowAlertsPopup(false)}>
          <div className="space-y-3">
            {data.healthAlerts.map(alert => {
              const cow = data.cows.find(c => c._id === alert.cowId);
              return (
                <div key={alert._id} className="flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg h-fit"><AlertCircle className="w-4 h-4 text-amber-600" /></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{cow ? `${genderLabel(cow)} ${cow.name}` : 'Unknown'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{alert.type} — {alert.description}</p>
                    {alert.medicine && <p className="text-[10px] text-slate-400">Medicine: {alert.medicine}</p>}
                    <p className="text-[10px] font-medium text-amber-600 mt-1">Due: {new Date(alert.nextDueDate!).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Popup>
      )}

      {showMilkPopup && (
        <Popup key="milk" title="Milk Production" rangeLabel={rangeLabel} onClose={() => setShowMilkPopup(false)}>
          <div className="space-y-2">
            {rangeMilkByCow.map(d => (
              <div key={d.cow._id} className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CowImg src={d.cow.image} name={d.cow.name} size="w-7 h-7" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{genderLabel(d.cow)} {d.cow.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-teal-600">{fmt(d.total)}L</p>
                  <p className="text-[10px] text-slate-400">M: {fmt(d.morning)} · E: {fmt(d.evening)} · Sold: {fmt(d.saleable)}</p>
                </div>
              </div>
            ))}
            {rangeMilkByCow.length === 0 && <p className="text-sm text-slate-400 text-center py-4">No milk recorded in this range</p>}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <span className="text-sm font-medium text-slate-500">Total</span>
            <span className="text-lg font-bold text-teal-600">{fmt(rangeTotalMilk)}L</span>
          </div>
        </Popup>
      )}

      {showPnlPopup && (
        <Popup key="pnl" title="Profit & Loss" rangeLabel={rangeLabel} onClose={() => setShowPnlPopup(false)}>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
              <span className="text-xs text-emerald-700 dark:text-emerald-400">Milk Revenue</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmtPKR(rangeRevenue)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
              <span className="text-xs text-red-700 dark:text-red-400">Expenses</span>
              <span className="text-sm font-bold text-red-700 dark:text-red-400">{fmtPKR(rangeExpenses)}</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-lg ${profitLoss >= 0 ? 'bg-teal-50 dark:bg-teal-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
              <span className={`text-xs font-medium ${profitLoss >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}>Net</span>
              <span className={`text-lg font-bold ${profitLoss >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-red-700 dark:text-red-400'}`}>{fmtPKR(profitLoss)}</span>
            </div>
            <button onClick={() => { setShowPnlPopup(false); onNavigate('reports'); }} className="w-full rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white px-4 py-2 text-sm font-semibold">Open Reports</button>
          </div>
        </Popup>
      )}

      {showRatePopup && (
        <Popup key="rate" title="Milk Rate History" rangeLabel={rangeLabel} onClose={() => setShowRatePopup(false)}>
          <div className="flex items-center justify-between p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg mb-3">
            <span className="text-xs text-teal-600 font-medium">Current Rate</span>
            <span className="text-lg font-bold text-teal-700 dark:text-teal-400">{fmtPKR(data.rate?.value || 0)}/L</span>
          </div>
          <div className="space-y-2">
            {rateHistory.sort((a, b) => b.date.localeCompare(a.date)).map(h => (
              <div key={h._id} className="flex items-center justify-between p-2 text-sm">
                <span className="text-slate-500">{h.date}</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(h.value)}/L</span>
              </div>
            ))}
            {rateHistory.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No rate changes yet</p>}
          </div>
        </Popup>
      )}

      {showTopPopup && (
        <Popup key="top" title="Top Producers" rangeLabel={rangeLabel} onClose={() => setShowTopPopup(false)}>
          <div className="space-y-3">
            {topProducers.map((p, i) => {
              const avg = p.milk / rangeDays;
              const second = topProducers[1];
              const lead = i === 0 && second ? p.milk - second.milk : 0;
              return (
                <div key={p.cow!._id} className={`p-4 rounded-lg ${i === 0 ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-slate-300 dark:text-slate-600">#{i + 1}</span>
                    <CowImg src={p.cow!.image} name={p.cow!.name} size="w-12 h-12" />
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{genderLabel(p.cow!)} {p.cow!.name}</p>
                      <p className="text-xs text-slate-500">{p.cow!.breed} · {p.cow!.gender === 'male' ? 'Bull' : `Lact #${p.cow!.lactationNumber || 0}`}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-teal-600">{fmt(p.milk)}L</p>
                      <p className="text-[10px] text-slate-400">Avg: {fmt(avg)}L/day</p>
                    </div>
                  </div>
                  {i === 0 && lead > 0 && (
                    <p className="text-[10px] text-teal-600 mt-2 ml-14">🏆 Leading by {fmt(lead)}L over #2</p>
                  )}
                </div>
              );
            })}
          </div>
        </Popup>
      )}
      </AnimatePresence>
    </div>
  );
}

/** Staggered list entrance helper — delays each child's fade-up by index * 0.035s (spec §4). */
function StaggerItem({ index, children, className = '' }: { index: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={prefersReducedMotion() ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut', delay: staggerDelay(index) }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, trend, trendUnit = '', subText, isNegative, isProfit }: any) {
  const isPositive = trend && trend > 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={cardSpring}
      className={`group relative overflow-hidden rounded-2xl border bg-white/90 dark:bg-slate-900/90 p-4 shadow-sm backdrop-blur transition-colors duration-200 hover:shadow-xl ${
      isProfit === true ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10' :
      isProfit === false ? 'border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/10' :
      'border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700'
    }`}>
      <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-500/10 transition-transform duration-300 group-hover:scale-125" />
      <Eye className="absolute right-3 bottom-3 w-3.5 h-3.5 text-emerald-500/70 opacity-0 group-hover:opacity-100 transition" />
      <div className="relative flex justify-between items-start mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <motion.div
          whileHover={{ rotate: -6, scale: 1.06 }}
          transition={wobbleSpring}
          className="rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-2 text-emerald-600 dark:text-emerald-300"
        >
          <Icon className="w-4 h-4" />
        </motion.div>
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`font-display text-2xl font-bold ${isNegative ? 'text-red-600 dark:text-red-400' : isProfit === true ? 'text-emerald-700 dark:text-emerald-400' : isProfit === false ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{value}</span>
          {trend !== undefined && trend !== 0 && (
            <div className={`flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'}`}>
              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(trend)}{trendUnit}
            </div>
          )}
        </div>
        {subText && <p className="text-[11px] text-slate-400 mt-1">{subText}</p>}
      </div>
    </motion.div>
  );
}

function Popup({ title, rangeLabel, children, onClose }: { title: string; rangeLabel?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <ViewportModal
      onClose={onClose}
      panelClassName="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-5 transition-transform duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          {rangeLabel && <p className="text-[10px] font-mono text-slate-400 mt-0.5">{rangeLabel}</p>}
        </div>
        <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={onClose} className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1 transition-colors"><X className="w-5 h-5 text-slate-400" /></motion.button>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.08 }}>
        {children}
      </motion.div>
    </ViewportModal>
  );
}
