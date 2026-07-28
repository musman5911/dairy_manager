import React, { useState, useEffect } from 'react';
import { api } from '../api';
import type { Cow, HealthRecord, HealthType } from '../types';
import { todayStr } from '../utils/date';
import { 
  Plus, 
  Filter, 
  Trash2, 
  Edit2, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Stethoscope,
  AlertCircle,
  Activity,
  CalendarDays
} from 'lucide-react';

interface HealthTabProps {
  isAdmin: boolean;
  canDelete?: boolean;
}

const typeStyles: Record<HealthType, string> = {
  vaccination: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  treatment: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  checkup: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  deworming: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

const HealthTab: React.FC<HealthTabProps> = ({ isAdmin, canDelete = isAdmin }) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [upcoming, setUpcoming] = useState<HealthRecord[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters
  const [cowFilter, setCowFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Form
  const [formData, setFormData] = useState({
    cowId: '',
    date: todayStr(),
    type: 'checkup' as HealthType,
    description: '',
    medicine: '',
    vet: '',
    nextDueDate: '',
    cost: '',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [healthData, cowsData, upcomingData] = await Promise.all([
        api.getHealth({ cowId: cowFilter || undefined, type: typeFilter || undefined }),
        api.getCows(),
        api.getUpcomingHealth()
      ]);
      setRecords(healthData);
      setCows(cowsData);
      setUpcoming(upcomingData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cowFilter, typeFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        cost: formData.cost ? parseFloat(formData.cost) : undefined,
        nextDueDate: formData.nextDueDate || undefined,
        medicine: formData.medicine || undefined,
        vet: formData.vet || undefined,
        notes: formData.notes || undefined
      };

      if (editingId) {
        await api.updateHealth(editingId, data);
      } else {
        await api.addHealth(data);
      }

      setFormData({
        cowId: '',
        date: todayStr(),
        type: 'checkup',
        description: '',
        medicine: '',
        vet: '',
        nextDueDate: '',
        cost: '',
        notes: ''
      });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      alert('Failed to save health record');
    }
  };

  const handleEdit = (record: HealthRecord) => {
    setFormData({
      cowId: record.cowId,
      date: record.date.split('T')[0],
      type: record.type,
      description: record.description,
      medicine: record.medicine || '',
      vet: record.vet || '',
      nextDueDate: record.nextDueDate ? record.nextDueDate.split('T')[0] : '',
      cost: record.cost ? record.cost.toString() : '',
      notes: record.notes || ''
    });
    setEditingId(record._id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await api.deleteHealth(id);
      fetchData();
    } catch (error) {
      alert('Failed to delete record');
    }
  };

  const isOverdue = (date: string) => new Date(date) < new Date();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Health Stats</h3>
            <Activity className="w-5 h-5 text-teal-600" />
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Total Records</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{records.length}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-xs">Upcoming/Overdue</p>
              <p className="text-2xl font-bold text-amber-600">{upcoming.length}</p>
            </div>
          </div>
        </div>

        {/* Upcoming Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Upcoming / Overdue</h3>
            <CalendarDays className="w-5 h-5 text-teal-600" />
          </div>
          <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No upcoming health events</p>
            ) : upcoming.map(item => (
              <div key={item._id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${typeStyles[item.type]}`}>
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {cows.find(c => c._id === item.cowId)?.name} - {item.type}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${isOverdue(item.nextDueDate!) ? 'text-red-500' : 'text-amber-500'}`}>
                    {new Date(item.nextDueDate!).toLocaleDateString()}
                  </p>
                  {isOverdue(item.nextDueDate!) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <AlertCircle className="w-2.5 h-2.5 mr-1" /> Overdue
                    </span>
                  )}
                </div>
              </div>
            ))}
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
              {editingId ? 'Edit Health Record' : 'Add Health Record'}
            </div>
            {showForm ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {showForm && (
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Cow *</label>
                <select
                  required
                  value={formData.cowId}
                  onChange={e => setFormData({ ...formData, cowId: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="">Select Cow</option>
                  {cows.map(cow => (
                    <option key={cow._id} value={cow._id}>{cow.name}</option>
                  ))}
                </select>
              </div>
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
                  onChange={e => setFormData({ ...formData, type: e.target.value as HealthType })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                >
                  <option value="vaccination">Vaccination</option>
                  <option value="treatment">Treatment</option>
                  <option value="checkup">Checkup</option>
                  <option value="deworming">Deworming</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Description *</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                  placeholder="e.g. FMD Vaccination"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Medicine</label>
                <input
                  type="text"
                  value={formData.medicine}
                  onChange={e => setFormData({ ...formData, medicine: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Vet Name</label>
                <input
                  type="text"
                  value={formData.vet}
                  onChange={e => setFormData({ ...formData, vet: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Next Due Date</label>
                <input
                  type="date"
                  value={formData.nextDueDate}
                  onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Cost (₨)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.cost}
                  onChange={e => setFormData({ ...formData, cost: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1 lg:col-span-3">
                <label className="text-slate-500 dark:text-slate-400 text-xs">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500 text-slate-800 dark:text-slate-100 min-h-[80px]"
                ></textarea>
              </div>
              <div className="lg:col-span-3 flex justify-end space-x-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setShowForm(false);
                      setFormData({
                        cowId: '',
                        date: todayStr(),
                        type: 'checkup',
                        description: '',
                        medicine: '',
                        vet: '',
                        nextDueDate: '',
                        cost: '',
                        notes: ''
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
                  {editingId ? 'Update Record' : 'Add Record'}
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
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={cowFilter}
              onChange={e => setCowFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="">All Cows</option>
              {cows.map(cow => (
                <option key={cow._id} value={cow._id}>{cow.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
            >
              <option value="">All Types</option>
              <option value="vaccination">Vaccination</option>
              <option value="treatment">Treatment</option>
              <option value="checkup">Checkup</option>
              <option value="deworming">Deworming</option>
              <option value="other">Other</option>
            </select>
          </div>
          {(cowFilter || typeFilter) && (
            <button 
              onClick={() => { setCowFilter(''); setTypeFilter(''); }}
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
                <th className="px-6 py-4 font-medium">Cow</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">Description</th>
                <th className="px-6 py-4 font-medium">Medicine/Vet</th>
                <th className="px-6 py-4 font-medium">Next Due</th>
                <th className="px-6 py-4 font-medium">Cost</th>
                {isAdmin && <th className="px-6 py-4 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-8 text-center text-slate-400">Loading records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-6 py-8 text-center text-slate-400">No records found</td>
                </tr>
              ) : records.map(record => (
                <tr key={record._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-sm">
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                    {cows.find(c => c._id === record.cowId)?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${typeStyles[record.type]}`}>
                      {record.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {record.description}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-700 dark:text-slate-300">{record.medicine || '-'}</div>
                    <div className="text-xs text-slate-500">{record.vet}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {record.nextDueDate ? (
                      <span className={isOverdue(record.nextDueDate) ? 'text-red-500 font-medium' : 'text-slate-600 dark:text-slate-400'}>
                        {new Date(record.nextDueDate).toLocaleDateString()}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">
                    {record.cost ? `₨ ${record.cost.toLocaleString()}` : '-'}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleEdit(record)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(record._id)}
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

export default HealthTab;
