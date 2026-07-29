import { useState, useEffect } from 'react';
import { api } from '../api';
import type { Cow, MilkEntry, RateHistory } from '../types';
import { fmt, fmtL, fmtPKR, monthKey, monthLabel, lastNMonths } from '../utils/format';
import { calcRevenueWithHistory } from '../utils/rates';
import { todayStr, shiftDate as shiftDateLocal } from '../utils/date';
import {
  Save, Trash2, History, List,
  ChevronLeft, ChevronRight, Calendar, Baby, Loader2
} from 'lucide-react';

interface MilkTabProps { isAdmin: boolean; canDelete?: boolean; }

export default function MilkTab({ isAdmin, canDelete = isAdmin }: MilkTabProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'history'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [cows, setCows] = useState<Cow[]>([]);
  const [milkRecords, setMilkRecords] = useState<MilkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [historyMonth, setHistoryMonth] = useState(monthKey(todayStr()));
  const [historyCowFilter, setHistoryCowFilter] = useState('');
  const [rate, setRate] = useState(0);
  const [rateDate, setRateDate] = useState('');
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);

  const [dailyEntries, setDailyEntries] = useState<Record<string, { morning: string; evening: string; calfMilk: string; existingId?: string }>>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const fetchOpts = viewMode === 'history'
        ? { month: historyMonth, cowId: historyCowFilter || undefined }
        : { from: selectedDate, to: selectedDate };

      const [cowsData, milkData, rateData, rateHist] = await Promise.all([
        api.getCows(),
        api.getMilk(fetchOpts),
        api.getRate(),
        api.getRateHistory(),
      ]);

      setCows(cowsData);
      setMilkRecords(milkData);
      setRate(rateData?.value || 0);
      setRateDate(rateData?.date || '');
      setRateHistory(rateHist);

      if (viewMode === 'daily') {
        const entries: Record<string, { morning: string; evening: string; calfMilk: string; existingId?: string }> = {};
        cowsData.filter((c: Cow) => c.status === 'active' || c.status === 'calf').forEach((cow: Cow) => {
          const existing = milkData.find((m: MilkEntry) => m.cowId === cow._id && m.date.startsWith(selectedDate));
          entries[cow._id] = {
            morning: existing ? String(existing.morning) : '',
            evening: existing ? String(existing.evening) : '',
            calfMilk: existing ? String(existing.calfMilk || '') : '',
            existingId: existing?._id,
          };
        });
        setDailyEntries(entries);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate, viewMode, historyMonth, historyCowFilter]);

  const handleSaveRow = async (cowId: string) => {
    const entry = dailyEntries[cowId];
    if (!entry) return;
    try {
      setSaving(cowId);
      await api.addMilk({
        cowId, date: selectedDate,
        morning: parseFloat(entry.morning) || 0,
        evening: parseFloat(entry.evening) || 0,
        calfMilk: parseFloat(entry.calfMilk) || 0,
        forceOverwrite: true,
      });
      fetchData();
    } catch (error) { alert(error instanceof Error ? error.message : 'Failed to save'); }
    finally { setSaving(null); }
  };

  const handleSaveAll = async () => {
    try {
      setSaving('all');
      const activeCows = cows.filter(c => c.status === 'active' || c.status === 'calf');
      await Promise.all(activeCows.map(cow => {
        const entry = dailyEntries[cow._id];
        if (!entry || (entry.morning === '' && entry.evening === '' && entry.calfMilk === '')) return Promise.resolve();
        return api.addMilk({
          cowId: cow._id, date: selectedDate,
          morning: parseFloat(entry.morning) || 0,
          evening: parseFloat(entry.evening) || 0,
          calfMilk: parseFloat(entry.calfMilk) || 0,
          forceOverwrite: true,
        });
      }));
      fetchData();
    } catch (error) { alert(error instanceof Error ? error.message : 'Failed to save all'); }
    finally { setSaving(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    try { await api.deleteMilk(id); fetchData(); }
    catch (error) { alert(error instanceof Error ? error.message : 'Failed to delete'); }
  };

  const dailyTotals = Object.values(dailyEntries).reduce((acc, curr) => ({
    morning: acc.morning + (parseFloat(curr.morning) || 0),
    evening: acc.evening + (parseFloat(curr.evening) || 0),
    calfMilk: acc.calfMilk + (parseFloat(curr.calfMilk) || 0),
  }), { morning: 0, evening: 0, calfMilk: 0 });

  const cowMap = Object.fromEntries(cows.map(c => [c._id, c.name]));

  // History: group by cow, sum per month
  const historyByCow = historyCowFilter
    ? milkRecords.filter(m => m.cowId === historyCowFilter)
    : milkRecords;

  const historyTotal = historyByCow.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
  const historyRevenue = calcRevenueWithHistory(historyByCow, rateHistory, rate, rateDate);

  const months = lastNMonths(6);

  function shiftDate(days: number) {
    setSelectedDate(shiftDateLocal(selectedDate, days));
  }

  return (
    <div className="space-y-6 tab-panel">
      {/* ── Mode Toggle ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'daily' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <List className="h-4 w-4" /> Daily Entry
          </button>
          <button onClick={() => setViewMode('history')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <History className="h-4 w-4" /> History
          </button>
        </div>

        {viewMode === 'daily' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input type="date" className="border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <button onClick={() => shiftDate(1)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)}>
              {months.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
            </select>
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={historyCowFilter} onChange={e => setHistoryCowFilter(e.target.value)}>
              <option value="">All Cows</option>
              {cows.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Daily Entry ────────────────────────── */}
      {viewMode === 'daily' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="px-5 py-3">Cow</th>
                  <th className="px-5 py-3">Morning (L)</th>
                  <th className="px-5 py-3">Evening (L)</th>
                  <th className="px-5 py-3">Calf Milk (L)</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Saleable</th>
                  <th className="px-5 py-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                ) : cows.filter(c => c.status === 'active' || c.status === 'calf').length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">No active cows</td></tr>
                ) : cows.filter(c => c.status === 'active' || c.status === 'calf').map(cow => {
                  const entry = dailyEntries[cow._id] || { morning: '', evening: '', calfMilk: '' };
                  const total = (parseFloat(entry.morning) || 0) + (parseFloat(entry.evening) || 0);
                  const calf = parseFloat(entry.calfMilk) || 0;
                  const saleable = Math.max(0, total - calf);
                  const isNursing = cow.nursingUntil && cow.nursingUntil >= selectedDate;
                  return (
                    <tr key={cow._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{cow.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{cow._id.slice(-6).toUpperCase()}</p>
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" step="0.1" className="w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
                          value={entry.morning} onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, morning: e.target.value } })} />
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" step="0.1" className="w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
                          value={entry.evening} onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, evening: e.target.value } })} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {isNursing && <Baby className="w-3 h-3 text-pink-500" />}
                          <input type="number" step="0.1" className="w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
                            value={entry.calfMilk} onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, calfMilk: e.target.value } })} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-teal-600">{total > 0 ? `${fmt(total)} L` : '-'}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{saleable > 0 ? `${fmt(saleable)} L` : '-'}</td>
                      <td className="px-5 py-3 text-right">
                        {isAdmin && (
                          <button onClick={() => handleSaveRow(cow._id)} disabled={saving === cow._id}
                            className="p-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg disabled:opacity-50">
                            {saving === cow._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/50 dark:bg-slate-800/30">
                <tr className="font-bold text-slate-800 dark:text-slate-100">
                  <td className="px-5 py-3 text-sm">TOTALS</td>
                  <td className="px-5 py-3 text-sm">{fmt(dailyTotals.morning)} L</td>
                  <td className="px-5 py-3 text-sm">{fmt(dailyTotals.evening)} L</td>
                  <td className="px-5 py-3 text-sm text-pink-500">{fmt(dailyTotals.calfMilk)} L</td>
                  <td className="px-5 py-3 text-sm text-teal-600">{fmt(dailyTotals.morning + dailyTotals.evening)} L</td>
                  <td className="px-5 py-3 text-sm text-emerald-600">{fmt(Math.max(0, dailyTotals.morning + dailyTotals.evening - dailyTotals.calfMilk))} L</td>
                  <td className="px-5 py-3 text-right">
                    {isAdmin && (
                      <button onClick={handleSaveAll} disabled={saving !== null}
                        className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50 ml-auto">
                        <Save className="h-4 w-4" /> Save All
                      </button>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ── History View ──────────────────────── */
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">Month</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{monthLabel(historyMonth)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Total Milk</p>
                <p className="text-lg font-bold text-teal-600">{fmtL(historyTotal)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Revenue</p>
                <p className="text-lg font-bold text-emerald-600">{fmtPKR(historyRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Records</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{historyByCow.length}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Cow</th>
                    <th className="px-5 py-3">Morning</th>
                    <th className="px-5 py-3">Evening</th>
                    <th className="px-5 py-3">Calf</th>
                    <th className="px-5 py-3">Total</th>
                    {canDelete && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={canDelete ? 7 : 6} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
                  ) : historyByCow.length === 0 ? (
                    <tr><td colSpan={canDelete ? 7 : 6} className="px-5 py-12 text-center text-slate-400">No records for {monthLabel(historyMonth)}</td></tr>
                  ) : historyByCow.map(record => (
                    <tr key={record._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 text-sm">
                      <td className="px-5 py-3 text-slate-500">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{cowMap[record.cowId] || 'Unknown'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{fmt(record.morning)} L</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{fmt(record.evening)} L</td>
                      <td className="px-5 py-3 text-pink-500">{record.calfMilk ? `${fmt(record.calfMilk)} L` : '-'}</td>
                      <td className="px-5 py-3 font-semibold text-teal-600">{fmt(record.morning + record.evening)} L</td>
                      {canDelete && (
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => handleDelete(record._id)} className="p-1.5 text-slate-400 hover:text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
