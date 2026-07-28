import React, { useState, useEffect } from 'react';
import { api } from '../api';
import type { Cow, Expense, ExpenseType } from '../types';
import { todayStr } from '../utils/date';
import { 
  Plus, 
  Calendar, 
  Filter, 
  Trash2, 
  Edit2, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Banknote,
} from 'lucide-react';

interface ExpensesTabProps {
  isAdmin: boolean;
  canDelete?: boolean;
}

const typeStyles: Record<ExpenseType, string> = {
  feed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medicine: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  equipment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  labor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  purchasing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  misc: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const ExpensesTab: React.FC<ExpensesTabProps> = ({ isAdmin, canDelete = isAdmin }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters — default to current month
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultTo = todayStr();
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Form
  const [formData, setFormData] = useState({
    date: todayStr(),
    type: 'feed' as ExpenseType,
    amount: '',
    cowId: '',
    note: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expensesData, cowsData] = await Promise.all([
        api.getExpenses({ from: dateFrom, to: dateTo, type: typeFilter || undefined }),
        api.getCows()
      ]);
      setExpenses(expensesData);
      setCows(cowsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFrom, dateTo, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        date: formData.date,
        type: formData.type,
        amount: parseFloat(formData.amount),
        cowId: formData.cowId || null,  // null = farm-wide (explicitly clears cow)
        note: formData.note || undefined
      };

      if (editingId) {
        await api.updateExpense(editingId, data);
      } else {
        await api.addExpense(data);
      }

      setFormData({
        date: todayStr(),
        type: 'feed',
        amount: '',
        cowId: '',
        note: ''
      });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      alert('Failed to save expense');
    }
  };

  const handleEdit = (expense: Expense) => {
    setFormData({
      date: expense.date.split('T')[0],
      type: expense.type,
      amount: expense.amount.toString(),
      cowId: expense.cowId || '',
      note: expense.note || ''
    });
    setEditingId(expense._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      fetchData();
    } catch (error) {
      alert('Failed to delete expense');
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const expByType: Record<string, number> = {};
  expenses.forEach(e => { expByType[e.type] = (expByType[e.type] || 0) + e.amount; });

  return (
    <div className="space-y-6">
      {/* Summary + Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Expenses</p>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center mt-1">
            <Banknote className="w-6 h-6 mr-1 text-teal-600" />
            ₨ {totalExpenses.toLocaleString()}
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-3">Breakdown</p>
          <div className="space-y-2">
            {Object.entries(expByType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([type, amount]) => {
              const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : '0';
              return (
                <div key={type} className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeStyles[type as ExpenseType]}`}>{type}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-20 text-right">₨{amount.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin Add Form */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <button 
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) setEditingId(null);
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center text-slate-800 dark:text-slate-100 font-semibold">
              <Plus className="w-5 h-5 mr-2 text-teal-600" />
              {editingId ? 'Edit Expense' : 'Add New Expense'}
            </div>
            {showForm ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showForm && (
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as ExpenseType })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="feed">Feed</option>
                  <option value="medicine">Medicine</option>
                  <option value="equipment">Equipment</option>
                  <option value="labor">Labor</option>
                  <option value="purchasing">Purchasing</option>
                  <option value="misc">Misc</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Amount (₨) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Cow (Optional)</label>
                <select
                  value={formData.cowId}
                  onChange={e => setFormData({ ...formData, cowId: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Farm-wide</option>
                  {cows.map(cow => (
                    <option key={cow._id} value={cow._id}>{cow.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Note</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                  placeholder="Additional details..."
                />
              </div>
              <div className="lg:col-span-3 flex justify-end space-x-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setShowForm(false);
                      setFormData({
                        date: todayStr(),
                        type: 'feed',
                        amount: '',
                        cowId: '',
                        note: ''
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6 py-2 text-sm font-medium"
                >
                  {editingId ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              placeholder="From"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              placeholder="To"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
                <option value="">All Types</option>
                <option value="feed">Feed</option>
                <option value="medicine">Medicine</option>
                <option value="equipment">Equipment</option>
                <option value="labor">Labor</option>
                <option value="purchasing">Purchasing</option>
                <option value="misc">Misc</option>
            </select>
          </div>
          {(dateFrom || dateTo || typeFilter) && (
            <button 
              onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter(''); }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center"
            >
              <X className="w-3 h-3 mr-1" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Cow</th>
                <th className="px-6 py-4 font-medium">Note</th>
                {isAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-slate-400">Loading expenses...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-slate-400">No expenses found</td>
                </tr>
              ) : expenses.map(expense => (
                <tr key={expense._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${typeStyles[expense.type]}`}>
                      {expense.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    ₨ {expense.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {expense.cowId ? cows.find(c => c._id === expense.cowId)?.name || 'Unknown' : 'Farm-wide'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                    {expense.note || '-'}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleEdit(expense)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(expense._id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpensesTab;
