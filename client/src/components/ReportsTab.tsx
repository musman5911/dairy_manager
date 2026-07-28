import { useState, useEffect } from 'react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { api } from '../api';
import type { Cow, MilkEntry, Expense, ExpenseType, Rate, Sale, RateHistory } from '../types';
import { fmt, fmtPKR, fmtL, monthKey, monthLabel, lastNMonths } from '../utils/format';
import { calcRevenueWithHistory } from '../utils/rates';
import { todayStr, shiftDate } from '../utils/date';
import { generateMilkReport, generateExpenseReport, generateSummaryReport, generateCowReport } from '../reportExport';
import ViewportModal from './ViewportModal';

function exportRangeLabel(days: number): string {
  const labels: Record<number, string> = { 1: 'Last 1 Day', 7: 'Last 7 Days', 30: 'Last 1 Month', 180: 'Last 6 Months', 365: 'Last 1 Year' };
  return labels[days] || `Last ${days} Days`;
}

const EXPENSE_COLORS: Record<string, string> = {
  feed: '#3b82f6',
  medicine: '#ef4444',
  labor: '#a855f7',
  equipment: '#f97316',
  purchasing: '#d97706',
  misc: '#64748b',
};

const DIRECT_EXPENSE_TYPES: ExpenseType[] = ['feed', 'medicine', 'labor', 'equipment', 'misc'];
type AnimalCategory = 'cow' | 'bull' | 'calf';
type CostAnimal = Cow & {
  category: AnimalCategory;
  milkL: number;
  revenue: number;
  expenses: number;
  feed: number;
  purchaseInMonth: number;
  saleIncome: number;
  net: number;
};

function animalCategory(cow: Cow): AnimalCategory {
  if (cow.isCalf || cow.status === 'calf') return 'calf';
  if (cow.gender === 'male') return 'bull';
  return 'cow';
}

export default function ReportsTab() {
  const [cows, setCows] = useState<Cow[]>([]);
  const [milkEntries, setMilkEntries] = useState<MilkEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [rate, setRate] = useState<Rate | null>(null);
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(monthKey(todayStr()));

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const from = shiftDate(todayStr(), -365);

        const [cowsData, milkData, expensesData, rateData, salesData, rateHist] = await Promise.all([
          api.getCows(),
          api.getMilk({ from }),
          api.getExpenses({ from }),
          api.getRate(),
          api.getSales({ from }),
          api.getRateHistory(),
        ]);

        setCows(cowsData);
        setMilkEntries(milkData);
        setExpenses(expensesData);
        setRate(rateData);
        setSales(salesData);
        setRateHistory(rateHist);
      } catch (error) {
        console.error('Failed to fetch report data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading reports...</div>;

  const currentRate = rate?.value || 0;
  const months = lastNMonths(12);
  const thisMonth = months[months.length - 1];

  // Range options
  const rangeOptions = [
    { key: '3m', label: 'Last 3 Months', count: 3 },
    { key: '6m', label: 'Last 6 Months', count: 6 },
    { key: '1y', label: 'Last 1 Year', count: 12 },
  ];
  const isRange = selectedMonth === '3m' || selectedMonth === '6m' || selectedMonth === '1y';
  const selectedRange = rangeOptions.find(r => r.key === selectedMonth);
  const rangeMonthKeys = selectedRange ? months.slice(-selectedRange.count) : [selectedMonth];
  const rangeLabel = selectedRange ? selectedRange.label : monthLabel(selectedMonth);

  // ── Monthly stats ──────────────────────────────────────────────
  function getMonthStats(mk: string) {
    const mkMilk = milkEntries.filter(m => monthKey(m.date) === mk);
    const mkExp = expenses.filter(e => monthKey(e.date) === mk);
    const mkSales = sales.filter(s => monthKey(s.date) === mk);

    const milkL = mkMilk.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const calfMilk = mkMilk.reduce((a, m) => a + (m.calfMilk || 0), 0);
    const milkRevenue = calcRevenueWithHistory(mkMilk, rateHistory, currentRate, rate?.date || '');
    const saleIncome = mkSales.reduce((a, s) => a + (s.salePrice || 0), 0);
    const totalExp = mkExp.reduce((a, e) => a + (e.amount || 0), 0);

    const expByType: Record<string, number> = {};
    mkExp.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + (e.amount || 0); });

    // Operating profit = milk revenue - expenses (excludes one-time animal sales)
    const operatingProfit = milkRevenue - totalExp;
    // Total profit includes sales (one-time income)
    const totalProfit = operatingProfit + saleIncome;

    return { milkL, calfMilk, milkRevenue, saleIncome, totalExp, operatingProfit, totalProfit, expByType, sales: mkSales };
  }

  const currentStats = getMonthStats(thisMonth);

  // Selected stats — aggregate if range
  function getRangeStats(mks: string[]) {
    const milkL = mks.reduce((a, mk) => a + getMonthStats(mk).milkL, 0);
    const calfMilk = mks.reduce((a, mk) => a + getMonthStats(mk).calfMilk, 0);
    const milkRevenue = mks.reduce((a, mk) => a + getMonthStats(mk).milkRevenue, 0);
    const saleIncome = mks.reduce((a, mk) => a + getMonthStats(mk).saleIncome, 0);
    const totalExp = mks.reduce((a, mk) => a + getMonthStats(mk).totalExp, 0);
    const operatingProfit = milkRevenue - totalExp;
    const totalProfit = operatingProfit + saleIncome;
    const expByType: Record<string, number> = {};
    mks.forEach(mk => {
      const s = getMonthStats(mk);
      Object.entries(s.expByType).forEach(([k, v]) => { expByType[k] = (expByType[k] || 0) + v; });
    });
    const salesList = mks.flatMap(mk => getMonthStats(mk).sales);
    return { milkL, calfMilk, milkRevenue, saleIncome, totalExp, operatingProfit, totalProfit, expByType, sales: salesList };
  }
  const selectedStats = isRange ? getRangeStats(rangeMonthKeys) : getMonthStats(selectedMonth);

  // ── Expense pie data for selected month ────────────────────────
  const expensePie = Object.entries(selectedStats.expByType)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k === 'purchasing' ? 'Animal Purchase' : k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: EXPENSE_COLORS[k] || '#94a3b8',
    }));

  // ── Cost per animal (selected month or range) ──────────────────
  const selectedMilk = milkEntries.filter(m => rangeMonthKeys.includes(monthKey(m.date)));
  const selectedExpenses = expenses.filter(e => rangeMonthKeys.includes(monthKey(e.date)));
  const selectedSales = sales.filter(s => rangeMonthKeys.includes(monthKey(s.date)));

  const costPerAnimal: CostAnimal[] = cows.filter(c => c.status !== 'sold').map(cow => {
    const cowMilkRecords = selectedMilk.filter(m => m.cowId === cow._id);
    const cowMilk = cowMilkRecords.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const cowRevenue = calcRevenueWithHistory(cowMilkRecords, rateHistory, currentRate, rate?.date || '');
    const directExpenses = selectedExpenses.filter(e => e.cowId === cow._id && DIRECT_EXPENSE_TYPES.includes(e.type));
    const cowExp = directExpenses.reduce((a, e) => a + (e.amount || 0), 0);
    const cowFeed = directExpenses.filter(e => e.type === 'feed').reduce((a, e) => a + (e.amount || 0), 0);
    const cowPurchase = selectedExpenses.filter(e => e.cowId === cow._id && e.type === 'purchasing').reduce((a, e) => a + (e.amount || 0), 0);
    const cowSales = selectedSales.filter(s => s.cowId === cow._id).reduce((a, s) => a + (s.salePrice || 0), 0);
    return {
      ...cow,
      category: animalCategory(cow),
      milkL: cowMilk,
      revenue: cowRevenue,
      expenses: cowExp,
      feed: cowFeed,
      purchaseInMonth: cowPurchase,
      saleIncome: cowSales,
      net: cowRevenue + cowSales - cowExp - cowPurchase,
    };
  }).sort((a, b) => b.milkL - a.milkL);

  // Farm-wide expenses (no cowId assigned)
  const farmWideExpenses = selectedExpenses.filter(e => !e.cowId).reduce((a, e) => a + (e.amount || 0), 0);

  // Avg Milk / Cow divides by all animals classified as cows, including zero-milk cows.
  const categoryStats = ([
    { key: 'cow' as const, label: 'Cow', icon: '🐄' },
    { key: 'bull' as const, label: 'Bull', icon: '🐂' },
    { key: 'calf' as const, label: 'Calf', icon: '🐮' },
  ]).map(group => {
    const animals = costPerAnimal.filter(animal => animal.category === group.key);
    const count = animals.length;
    const totalCost = animals.reduce((sum, animal) => sum + animal.expenses, 0);
    const totalFeed = animals.reduce((sum, animal) => sum + animal.feed, 0);
    const totalMilk = animals.reduce((sum, animal) => sum + animal.milkL, 0);
    return {
      ...group,
      count,
      avgCost: count > 0 ? totalCost / count : null,
      avgFeed: count > 0 ? totalFeed / count : null,
      avgMilk: group.key === 'cow' && count > 0 ? totalMilk / count : null,
    };
  });

  const monthOptions = months.map(mk => ({ key: mk, label: monthLabel(mk) }));

  function shiftMonth(dir: number) {
    const idx = months.indexOf(selectedMonth);
    const next = idx + dir;
    if (next >= 0 && next < months.length) setSelectedMonth(months[next]);
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── Month/Range Selector ────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Calendar className="w-4 h-4 text-slate-400" />
        {!isRange && (
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
        >
          <optgroup label="Ranges">
            {rangeOptions.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </optgroup>
          <optgroup label="Months">
            {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </optgroup>
        </select>
        {!isRange && (
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Current Month Highlight ────────────────────────────── */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 text-white">
        <p className="text-xs font-medium opacity-80 uppercase tracking-wider">This Month — {monthLabel(thisMonth)}</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-3">
          <MiniStat label="Milk" value={fmtL(currentStats.milkL)} />
          <MiniStat label="Milk Revenue" value={fmtPKR(currentStats.milkRevenue)} />
          <MiniStat label="Expenses" value={fmtPKR(currentStats.totalExp)} />
          <MiniStat label="Operating Profit" value={fmtPKR(currentStats.operatingProfit)} highlight={currentStats.operatingProfit >= 0} />
          {currentStats.saleIncome > 0 && (
            <MiniStat label="Animal Sales" value={fmtPKR(currentStats.saleIncome)} />
          )}
          <MiniStat label="Total Profit" value={fmtPKR(currentStats.totalProfit)} highlight={currentStats.totalProfit >= 0} />
        </div>
        <p className="text-[10px] opacity-70 mt-2">* Operating Profit = Milk Revenue − Expenses | Total Profit includes animal sales</p>
      </div>

      {/* ── Selected Month/Range Stats ──────────────────────────── */}
      {selectedMonth !== thisMonth && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{rangeLabel} — Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <MiniStatDark label="Milk" value={fmtL(selectedStats.milkL)} />
            <MiniStatDark label="Milk Revenue" value={fmtPKR(selectedStats.milkRevenue)} />
            <MiniStatDark label="Expenses" value={fmtPKR(selectedStats.totalExp)} />
            <MiniStatDark label="Operating Profit" value={fmtPKR(selectedStats.operatingProfit)} positive={selectedStats.operatingProfit >= 0} />
            {selectedStats.saleIncome > 0 && (
              <MiniStatDark label="Animal Sales" value={fmtPKR(selectedStats.saleIncome)} />
            )}
            <MiniStatDark label="Total Profit" value={fmtPKR(selectedStats.totalProfit)} positive={selectedStats.totalProfit >= 0} />
          </div>
        </div>
      )}

      {/* ── Expense Breakdown ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">
          Expense Breakdown — {rangeLabel}
        </h3>
        {expensePie.length > 0 ? (
          <div className="flex items-center gap-6">
            <div className="w-40 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensePie} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}
                    isAnimationActive={false} stroke="none" strokeWidth={0}>
                    {expensePie.map((entry, i) => <Cell key={i} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtPKR(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {expensePie.map(e => (
                <div key={e.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                    {e.name}
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{fmtPKR(e.value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No expenses for this period</p>
        )}
      </div>

      {/* ── Category Cost Averages ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Average Cost by Category — {rangeLabel}</h3>
          <p className="text-xs text-slate-400 mt-1">Direct costs exclude animal purchases and farm-wide/unassigned expenses. Avg Milk / Cow divides by all cows in the group, including zero-milk cows.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {categoryStats.map(group => (
            <div key={group.key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">{group.icon} {group.label}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-500 border border-slate-200 dark:border-slate-700">{group.count}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Avg Cost / Animal</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{group.avgCost === null ? '-' : fmtPKR(group.avgCost)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Avg Feed / Animal</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{group.avgFeed === null ? '-' : fmtPKR(group.avgFeed)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 dark:text-slate-400">Avg Milk / Cow</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{group.avgMilk === null ? '-' : fmtL(group.avgMilk)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cost per Animal ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Cost per Animal — {rangeLabel}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="px-4 py-3 font-medium">Gender</th>
                <th className="px-4 py-3 font-medium text-right">Milk (L)</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Purchase</th>
                <th className="px-4 py-3 font-medium text-right">Expenses</th>
                <th className="px-4 py-3 font-medium text-right">Sales</th>
                <th className="px-4 py-3 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {costPerAnimal.map(cow => {
                const isMale = cow.gender === 'male';
                return (
                <tr key={cow._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{isMale ? '🐂 ' : '🐄 '}{cow.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      isMale ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                             : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                    }`}>{isMale ? 'Bull' : 'Cow'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{isMale ? '-' : fmt(cow.milkL)}</td>
                  <td className="px-4 py-3 text-right text-teal-600">{isMale ? '-' : fmtPKR(cow.revenue)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{cow.purchaseInMonth > 0 ? fmtPKR(cow.purchaseInMonth) : '-'}</td>
                  <td className="px-4 py-3 text-right text-red-500">{fmtPKR(cow.expenses)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{cow.saleIncome ? fmtPKR(cow.saleIncome) : '-'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${cow.net >= 0 ? 'text-teal-600' : 'text-red-500'}`}>{fmtPKR(cow.net)}</td>
                </tr>
                );
              })}
              {costPerAnimal.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No data for this period</td></tr>
              )}
            </tbody>
            {/* ── Farm-wide + Totals ──────────────────────── */}
            <tfoot>
              {farmWideExpenses > 0 && (
                <tr className="border-t border-stone-200 dark:border-stone-700 bg-amber-50/40 dark:bg-amber-900/10">
                  <td className="px-4 py-3 font-medium text-amber-700 dark:text-amber-400">Farm-wide (unassigned)</td>
                  <td className="px-4 py-3 text-stone-400">-</td>
                  <td className="px-4 py-3 text-right text-stone-400">-</td>
                  <td className="px-4 py-3 text-right text-stone-400">-</td>
                  <td className="px-4 py-3 text-right text-stone-400">-</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">{fmtPKR(farmWideExpenses)}</td>
                  <td className="px-4 py-3 text-right text-stone-400">-</td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600">-{fmtPKR(farmWideExpenses)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-teal-500 dark:border-teal-600 bg-teal-50/70 dark:bg-teal-900/20 font-bold text-teal-800 dark:text-teal-200">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3">-</td>
                <td className="px-4 py-3 text-right">{fmt(costPerAnimal.reduce((a, c) => a + (c.gender !== 'male' ? c.milkL : 0), 0))} L</td>
                <td className="px-4 py-3 text-right">{fmtPKR(costPerAnimal.reduce((a, c) => a + (c.gender !== 'male' ? c.revenue : 0), 0))}</td>
                <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">{fmtPKR(costPerAnimal.reduce((a, c) => a + c.purchaseInMonth, 0))}</td>
                <td className="px-4 py-3 text-right text-red-700 dark:text-red-400">{fmtPKR(costPerAnimal.reduce((a, c) => a + c.expenses, 0) + farmWideExpenses)}</td>
                <td className="px-4 py-3 text-right">{fmtPKR(costPerAnimal.reduce((a, c) => a + c.saleIncome, 0))}</td>
                <td className="px-4 py-3 text-right">{fmtPKR(costPerAnimal.reduce((a, c) => a + c.net, 0) - farmWideExpenses)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Animal Sales ───────────────────────────────────────── */}
      {selectedSales.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Animal Sales — {rangeLabel}</h3>
          <div className="space-y-2">
            {selectedSales.map(sale => {
              const cow = cows.find(c => c._id === sale.cowId);
              return (
                <div key={sale._id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{cow?.name || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">{sale.date}{sale.buyer ? ` · ${sale.buyer}` : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-purple-600">{fmtPKR(sale.salePrice)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Export Reports ───────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-sm p-5">
        <h3 className="font-semibold text-stone-800 dark:text-stone-100 mb-1">Export Reports</h3>
        <p className="text-sm text-stone-500 mb-4">Select date range and download PDF</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ExportButton
            label="Milk Report"
            color="stone"
            onGenerate={(rangeDays) => generateMilkReport({ month: selectedMonth, rangeLabel: exportRangeLabel(rangeDays), rangeDays, cows, milkEntries: selectedMilk, expenses: selectedExpenses, sales: selectedSales, rate: currentRate, rateHistory, rateDate: rate?.date || '', costPerAnimal })}
          />
          <ExportButton
            label="Expense Report"
            color="stone"
            onGenerate={(rangeDays) => generateExpenseReport({ month: selectedMonth, rangeLabel: exportRangeLabel(rangeDays), rangeDays, cows, milkEntries: selectedMilk, expenses: selectedExpenses, sales: selectedSales, rate: currentRate, rateHistory, rateDate: rate?.date || '', costPerAnimal })}
          />
          <ExportButton
            label="Monthly Summary"
            color="stone"
            onGenerate={(rangeDays) => generateSummaryReport({ month: selectedMonth, rangeLabel: exportRangeLabel(rangeDays), rangeDays, cows, milkEntries: selectedMilk, expenses: selectedExpenses, sales: selectedSales, rate: currentRate, rateHistory, rateDate: rate?.date || '', costPerAnimal, stats: selectedStats })}
          />
          <CowReportButton cows={cows} rate={currentRate} rateHistory={rateHistory} rateDate={rate?.date || ''} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
      <p className={`text-base font-bold ${highlight === false ? 'text-red-200' : ''}`}>{value}</p>
    </div>
  );
}

function MiniStatDark({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase">{label}</p>
      <p className={`text-base font-bold ${positive === true ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-lg inline-block' : positive === false ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/10 px-2 py-0.5 rounded-lg inline-block' : 'text-slate-800 dark:text-slate-100'}`}>{value}</p>
    </div>
  );
}

function ExportButton({ label, color: _color, onGenerate }: { label: string; color: string; onGenerate: (days: number) => void }) {
  const [range, setRange] = useState('30');
  const [showConfirm, setShowConfirm] = useState(false);
  const rangeLabels: Record<string, string> = { '1': 'Last 1 Day', '7': 'Last 7 Days', '30': 'Last 1 Month', '180': 'Last 6 Months', '365': 'Last 1 Year' };

  return (
    <>
      <div className="flex flex-col gap-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2">
        <p className="text-xs font-medium text-stone-700 dark:text-stone-300">{label}</p>
        <div className="flex items-center gap-2">
          <select className="flex-1 bg-transparent text-[10px] text-stone-500 outline-none" value={range} onChange={e => setRange(e.target.value)}>
            <option value="1">1 Day</option><option value="7">7 Days</option><option value="30">1 Month</option><option value="180">6 Months</option><option value="365">1 Year</option>
          </select>
          <button onClick={() => setShowConfirm(true)} className="p-1.5 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
      {showConfirm && (
        <ViewportModal
          onClose={() => setShowConfirm(false)}
          panelClassName="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-stone-800 shadow-lg p-6 max-w-sm w-full"
        >
          <h3 className="text-sm font-bold text-stone-800 dark:text-stone-100 mb-2">Download {label}</h3>
          <p className="text-sm text-stone-500 mb-4">Export data for <span className="font-medium">{rangeLabels[range]}</span>?</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-stone-600">Cancel</button>
            <button onClick={() => { onGenerate(parseInt(range)); setShowConfirm(false); }} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </ViewportModal>
      )}
    </>
  );
}

function CowReportButton({ cows, rate, rateHistory, rateDate }: { cows: Cow[]; rate: number; rateHistory: RateHistory[]; rateDate: string }) {
  const [selectedCow, setSelectedCow] = useState('');
  const [range, setRange] = useState('30');
  const [showConfirm, setShowConfirm] = useState(false);

  function handleDownload() {
    if (!selectedCow) return;
    setShowConfirm(true);
  }

  function confirmDownload() {
    generateCowReport(selectedCow, rate, rateHistory, rateDate, parseInt(range));
    setShowConfirm(false);
  }

  const rangeLabel: Record<string, string> = {
    '1': 'Last 1 Day',
    '7': 'Last 7 Days',
    '30': 'Last 1 Month',
    '180': 'Last 6 Months',
    '365': 'Last 1 Year',
  };

  return (
    <>
      <div className="flex flex-col gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        <select
          className="bg-transparent text-sm text-amber-700 dark:text-amber-400 outline-none"
          value={selectedCow}
          onChange={e => setSelectedCow(e.target.value)}
        >
          <option value="">Select Cow...</option>
          {cows.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <select
            className="flex-1 bg-transparent text-[10px] text-amber-600 dark:text-amber-500 outline-none"
            value={range}
            onChange={e => setRange(e.target.value)}
          >
            <option value="1">1 Day</option>
            <option value="7">7 Days</option>
            <option value="30">1 Month</option>
            <option value="180">6 Months</option>
            <option value="365">1 Year</option>
          </select>
          <button
            onClick={handleDownload}
            disabled={!selectedCow}
            className="p-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg disabled:opacity-30 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <ViewportModal
          onClose={() => setShowConfirm(false)}
          panelClassName="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg p-6 max-w-sm w-full"
        >
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Download Cow Report</h3>
          <p className="text-sm text-slate-500 mb-4">
            Export <span className="font-medium text-slate-700 dark:text-slate-300">{cows.find(c => c._id === selectedCow)?.name}</span> data for <span className="font-medium">{rangeLabel[range]}</span>?
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
            <button onClick={confirmDownload} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
        </ViewportModal>
      )}
    </>
  );
}
