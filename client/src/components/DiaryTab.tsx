import { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { api } from '../api';
import type { ChecklistItem } from '../types';
import { useDebouncedSave } from '../useDebouncedSave';
import SaveIndicator from './SaveIndicator';
import { todayStr, shiftDate } from '../utils/date';

const DEFAULT_CHECKLIST: Omit<ChecklistItem, 'done'>[] = [
  { id: 'morning-milking', text: 'Morning milking done' },
  { id: 'evening-milking', text: 'Evening milking done' },
  { id: 'feed-given',      text: 'Feed given' },
  { id: 'water-checked',   text: 'Water checked / refilled' },
  { id: 'health-check',    text: 'Checked for signs of illness' },
  { id: 'cleaning',        text: 'Shed cleaned' },
];

function newItemId(): string {
  return 'item-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function DiaryTab() {
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [newItemText, setNewItemText] = useState('');

  // Load the log whenever the selected date changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getDailyLog(date).then((log) => {
      if (cancelled) return;
      if (!log.checklist || log.checklist.length === 0) {
        setChecklist(DEFAULT_CHECKLIST.map(i => ({ ...i, done: false })));
      } else {
        setChecklist(log.checklist);
      }
      setNotes(log.notes || '');
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [date]);

  // Combine checklist + notes into one payload for autosave
  const payload = useMemo(() => ({ checklist, notes }), [checklist, notes]);

  const saveFn = useCallback((p: { checklist: ChecklistItem[]; notes: string }) => {
    return api.saveDailyLog(date, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const status = useDebouncedSave(payload, saveFn, 800);

  function toggleItem(id: string) {
    setChecklist(list => list.map(i => i.id === id ? { ...i, done: !i.done } : i));
  }

  function removeItem(id: string) {
    setChecklist(list => list.filter(i => i.id !== id));
  }

  function addItem() {
    const text = newItemText.trim();
    if (!text) return;
    setChecklist(list => [...list, { id: newItemId(), text, done: false }]);
    setNewItemText('');
  }

  function shiftDateLocal(days: number) {
    setDate(d => shiftDate(d, days));
  }

  const doneCount = checklist.filter(i => i.done).length;

  return (
    <div className="space-y-6 tab-panel">
      {/* Date navigation + save status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDateLocal(-1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            onClick={() => shiftDateLocal(1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {date !== todayStr() && (
            <button
              onClick={() => setDate(todayStr())}
              className="text-xs font-medium text-teal-600 hover:text-teal-700 px-2"
            >
              Today
            </button>
          )}
        </div>
        <SaveIndicator status={status} />
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Checklist */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Daily Checklist</h3>
              <span className="text-xs text-slate-400">{doneCount}/{checklist.length} done</span>
            </div>

            <div className="space-y-2">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-3 group">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleItem(item.id)}
                    className="w-4 h-4 accent-teal-600 shrink-0"
                  />
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="text-sm text-slate-400 py-4 text-center">No checklist items — add one below.</p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <input
                type="text"
                placeholder="Add a task..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
              />
              <button
                onClick={addItem}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-2 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          {/* Notes / Diary */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-4">Notes / Diary</h3>
            <textarea
              rows={12}
              placeholder="Anything worth remembering about today — weather, a cow acting off, a visitor, feed delivery, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100 resize-none"
            />
            <p className="text-[11px] text-slate-400 mt-2">Saves automatically as you type.</p>
          </div>
        </div>
      )}
    </div>
  );
}
