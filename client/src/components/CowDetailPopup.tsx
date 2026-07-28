import { useState, useEffect } from 'react';
import { X, Droplets, Heart, DollarSign, Baby, Tag, Scale, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api';
import type { Cow, MilkEntry, Expense, HealthRecord, RateHistory } from '../types';
import { fmt, fmtPKR, fmtL } from '../utils/format';
import { calcRevenueWithHistory } from '../utils/rates';
import { todayStr, shiftDate } from '../utils/date';
import ViewportModal from './ViewportModal';

interface CowSummary {
  cow: Cow;
  milk: { last7Days: number; last30Days: number; calfMilk30Days: number; records30: MilkEntry[]; totalLiters: number };
  expenses: { total30: number; byType: Record<string, number>; records30: Expense[]; totalAll: number };
  health: HealthRecord[];
  offspring: Cow[];
  mother: Cow | null;
  sale: { salePrice: number } | null;
  lifetime: { purchasePrice: number; salePrice: number; totalMilkLiters: number; milkRecords: MilkEntry[]; totalDirectExpenses: number; totalHealthCost: number };
}

function CowImg({ src, name, size = 'w-10 h-10' }: { src?: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`${size} rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-lg shrink-0`}>🐄</div>;
  }
  return <img src={src} alt={name} className={`${size} rounded-full object-cover border-2 border-teal-300 shrink-0`} onError={() => setBroken(true)} />;
}

interface Props {
  cowId: string;
  rate: number;
  rateHistory?: RateHistory[];
  rateDate?: string;
  onClose: () => void;
}

export default function CowDetailPopup({ cowId, rate, rateHistory = [], rateDate = '', onClose }: Props) {
  const [data, setData] = useState<CowSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getCowSummary(cowId)
      .then(setData)
      .catch(err => console.error('Failed to load cow summary:', err))
      .finally(() => setLoading(false));
  }, [cowId]);

  if (loading) {
    return (
      <ViewportModal onClose={onClose} panelClassName="bg-white dark:bg-slate-900 rounded-xl p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto" />
      </ViewportModal>
    );
  }

  if (!data) return null;

  const { cow, milk, expenses, health, offspring, mother } = data;
  const milkRev30 = calcRevenueWithHistory(milk.records30, rateHistory, rate, rateDate);

  return (
    <ViewportModal
      onClose={onClose}
      panelClassName="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
    >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <CowImg src={cow.image} name={cow.name} size="w-12 h-12" />
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{cow.name}</h2>
              <p className="text-xs text-slate-500">{cow.breed} · {cow.status} · Lact #{cow.lactationNumber || 0}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* ── Lifetime Profit (Sold Cows) ───────── */}
          {cow.status === 'sold' && data.lifetime && (
            <div className="bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Lifetime Profit</h4>
              {(() => {
                const l = data.lifetime;
                const milkRev = calcRevenueWithHistory(l.milkRecords || [], rateHistory, rate, rateDate);
                const totalCost = l.purchasePrice + l.totalHealthCost + l.totalDirectExpenses;
                const totalIncome = l.salePrice + milkRev;
                const profit = totalIncome - totalCost;
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-stone-400">Purchase Price:</span> <span className="font-medium">{fmtPKR(l.purchasePrice)}</span></div>
                      <div><span className="text-stone-400">Sale Price:</span> <span className="font-medium text-purple-600">{fmtPKR(l.salePrice)}</span></div>
                      <div><span className="text-stone-400">Total Milk ({fmt(l.totalMilkLiters)}L):</span> <span className="font-medium text-teal-600">{fmtPKR(milkRev)}</span></div>
                      <div><span className="text-stone-400">Health Costs:</span> <span className="font-medium text-red-500">{fmtPKR(l.totalHealthCost)}</span></div>
                      <div><span className="text-stone-400">Direct Expenses:</span> <span className="font-medium text-red-500">{fmtPKR(l.totalDirectExpenses)}</span></div>
                    </div>
                    <div className="border-t border-stone-200 dark:border-stone-700 pt-2 flex justify-between items-center">
                      <span className="text-sm font-medium text-stone-500">Net Profit</span>
                      <span className={`text-lg font-bold ${profit >= 0 ? 'text-teal-600' : 'text-red-500'}`}>{fmtPKR(profit)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Purchase Price (Active Cows) ──────── */}
          {cow.status !== 'sold' && (cow.purchasePrice || 0) > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-600">Purchase Price: <span className="font-bold">{fmtPKR(cow.purchasePrice || 0)}</span></p>
            </div>
          )}

          {/* ── Info Row ──────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoItem icon={Tag} label="Tag" value={`#${cow._id.slice(-6).toUpperCase()}`} />
            <InfoItem icon={Scale} label="Weight" value={cow.weight ? `${fmt(cow.weight)} kg` : 'N/A'} />
            <InfoItem icon={Activity} label="Birth" value={cow.birthDate || 'N/A'} />
            <InfoItem icon={Activity} label="Batch" value={cow.batch || 'N/A'} />
          </div>

          {/* ── Mother / Offspring ────────────────── */}
          {(mother || offspring.length > 0) && (
            <div className="bg-pink-50 dark:bg-pink-900/10 border border-pink-200 dark:border-pink-800 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-pink-700 dark:text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Baby className="w-3.5 h-3.5" /> Lineage
              </h4>
              {mother && <p className="text-sm text-slate-700 dark:text-slate-300">Mother: <span className="font-medium">{mother.name}</span> ({mother.breed})</p>}
              {cow.nursingUntil && (
                <p className="text-sm text-slate-700 dark:text-slate-300">Nursing until: <span className="font-medium">{cow.nursingUntil}</span></p>
              )}
              {offspring.length > 0 && (
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  Offspring: {offspring.map(o => o.name).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ── Milk Stats ────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5" /> Milk Production
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Last 7 Days" value={fmtL(milk.last7Days)} />
              <StatBox label="Last 30 Days" value={fmtL(milk.last30Days)} />
              <StatBox label="Calf Milk (30d)" value={fmtL(milk.calfMilk30Days)} color="text-pink-600" />
              <StatBox label="Revenue (30d)" value={fmtPKR(milkRev30)} color="text-emerald-600" />
            </div>
          </div>

          {/* ── 14-Day Milk Chart ──────────────────── */}
          {milk.records30.length > 0 && (() => {
            const chartData = [];
            for (let i = 13; i >= 0; i--) {
              const dateStr = shiftDate(todayStr(), -i);
              const entry = milk.records30.find(m => m.date === dateStr);
              const total = entry ? Math.round(((entry.morning || 0) + (entry.evening || 0)) * 10) / 10 : 0;
              chartData.push({ name: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }), milk: total });
            }
            return (
              <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Last 14 Days Milk</h4>
                <div className="h-36 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                      <Line type="monotone" dataKey="milk" stroke="#0d9488" strokeWidth={2} dot={{ r: 3, fill: '#0d9488', strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* ── Expenses ──────────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Expenses (30 days)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatBox label="Total" value={fmtPKR(expenses.total30)} color="text-red-500" />
              {Object.entries(expenses.byType).filter(([, v]) => v > 0).map(([type, amount]) => (
                <StatBox key={type} label={type.charAt(0).toUpperCase() + type.slice(1)} value={fmtPKR(amount)} />
              ))}
            </div>
          </div>

          {/* ── Health Records ────────────────────── */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" /> Health Records (last 10)
            </h4>
            {health.length > 0 ? (
              <div className="space-y-2">
                {health.map(h => (
                  <div key={h._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{h.description}</p>
                      <p className="text-xs text-slate-400">{h.date} · {h.type}{h.medicine ? ` · ${h.medicine}` : ''}</p>
                    </div>
                    <div className="text-right">
                      {h.cost ? <p className="text-xs font-medium text-slate-600">{fmtPKR(h.cost)}</p> : null}
                      {h.nextDueDate && <p className="text-[10px] text-amber-500">Due: {h.nextDueDate}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No health records</p>
            )}
          </div>
        </div>
    </ViewportModal>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-400 uppercase">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <p className="text-[10px] text-slate-400 uppercase mb-1">{label}</p>
      <p className={`text-base font-bold ${color || 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}
