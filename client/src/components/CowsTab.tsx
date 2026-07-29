import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { Cow, CowStatus } from '../types';
import { fmt, fmtPKR } from '../utils/format';
import {
  Plus, Edit2, Trash2, X, Save,
  CheckCircle2, Info, Tag, Activity, Banknote, Baby
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ViewportModal from './ViewportModal';

interface CowsTabProps {
  isAdmin: boolean;
}

const statusColors: Record<CowStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  dry: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  pregnant: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
  inactive: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
  sold: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
  calf: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-800',
};

export default function CowsTab({ isAdmin }: CowsTabProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCalfForm, setShowCalfForm] = useState(false);
  const [editingCow, setEditingCow] = useState<Cow | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CowStatus | 'all' | 'female' | 'male'>('all');
  const [batches, setBatches] = useState<string[]>([]);
  const [batchFilter, setBatchFilter] = useState('');
  const [saleCow, setSaleCow] = useState<Cow | null>(null);
  const [saleForm, setSaleForm] = useState({ date: new Date().toISOString().slice(0, 10), salePrice: '', buyer: '', notes: '' });

  const [formData, setFormData] = useState<Partial<Cow>>({
    name: '', breed: '', gender: 'female', status: 'active', birthDate: '', weight: undefined,
    lactationNumber: 0, notes: '', calvingDate: '', pregnancyDate: '', batch: '', image: '', purchasePrice: 0,
  });

  const [calfForm, setCalfForm] = useState({
    name: '', breed: '', gender: 'female' as 'female' | 'male', motherId: '', birthDate: new Date().toISOString().slice(0, 10),
    weight: '', notes: '', nursingMonths: 2.5, purchasePrice: '',
  });

  const loadCows = async () => {
    try {
      setLoading(true);
      const [data, batchData] = await Promise.all([api.getCows(), api.getCowBatches()]);
      setCows(data);
      setBatches(batchData);
    } catch (error) {
      console.error('Failed to load cows:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCows(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCow) {
        await api.updateCow(editingCow._id, formData);
      } else {
        await api.createCow(formData);
      }
      setShowForm(false);
      setEditingCow(null);
      resetForm();
      loadCows();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save cow');
    }
  };

  const handleAddCalf = async (e: React.FormEvent) => {
    e.preventDefault();
    const mother = cows.find(c => c._id === calfForm.motherId);
    if (!mother) { alert('Select a mother cow'); return; }
    const nursingUntil = new Date(calfForm.birthDate);
    nursingUntil.setDate(nursingUntil.getDate() + Math.round(calfForm.nursingMonths * 30));
    try {
      await api.createCow({
        name: calfForm.name,
        breed: calfForm.breed || mother.breed,
        gender: calfForm.gender,
        status: 'calf',
        birthDate: calfForm.birthDate,
        weight: calfForm.weight ? parseFloat(calfForm.weight) : undefined,
        motherId: calfForm.motherId,
        isCalf: true,
        nursingUntil: nursingUntil.toISOString().slice(0, 10),
        notes: calfForm.notes,
        lactationNumber: 0,
        purchasePrice: calfForm.purchasePrice ? parseFloat(calfForm.purchasePrice) : 0,
      });
      setShowCalfForm(false);
      setCalfForm({ name: '', breed: '', gender: 'female', motherId: '', birthDate: new Date().toISOString().slice(0, 10), weight: '', notes: '', nursingMonths: 2.5, purchasePrice: '' });
      loadCows();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add calf');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this animal?')) return;
    try { await api.deleteCow(id); loadCows(); } catch (error) { alert(error instanceof Error ? error.message : 'Failed to delete'); }
  };

  const handleRecordSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCow) return;
    const price = parseFloat(saleForm.salePrice);
    if (!price || price <= 0) { alert('Enter a valid sale price'); return; }
    try {
      await api.addSale({ cowId: saleCow._id, date: saleForm.date, salePrice: price, buyer: saleForm.buyer, notes: saleForm.notes });
      setSaleCow(null);
      setSaleForm({ date: new Date().toISOString().slice(0, 10), salePrice: '', buyer: '', notes: '' });
      loadCows();
    } catch (error) { alert(error instanceof Error ? error.message : 'Failed to record sale'); }
  };

  const handleEdit = (cow: Cow) => {
    setEditingCow(cow);
    setFormData({
      name: cow.name, breed: cow.breed, gender: cow.gender || 'female', status: cow.status, birthDate: cow.birthDate || '',
      weight: cow.weight, lactationNumber: cow.lactationNumber || 0, notes: cow.notes || '',
      calvingDate: cow.calvingDate || '', pregnancyDate: cow.pregnancyDate || '', batch: cow.batch || '', image: cow.image || '', purchasePrice: cow.purchasePrice || 0,
    });
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const resetForm = () => {
    setFormData({ name: '', breed: '', gender: 'female', status: 'active', birthDate: '', weight: undefined, lactationNumber: 0, notes: '', calvingDate: '', pregnancyDate: '', batch: '', image: '', purchasePrice: 0 });
    setEditingCow(null);
  };

  const stats = {
    total: cows.length,
    female: cows.filter(c => c.gender !== 'male').length,
    male: cows.filter(c => c.gender === 'male').length,
    active: cows.filter(c => c.status === 'active').length,
    pregnant: cows.filter(c => c.status === 'pregnant').length,
    dry: cows.filter(c => c.status === 'dry').length,
    calf: cows.filter(c => c.status === 'calf').length,
    sold: cows.filter(c => c.status === 'sold').length,
  };

  const statCards = [
    { label: 'Total', value: stats.total, filter: 'all' as const, icon: Tag, color: 'text-slate-600' },
    { label: 'Cows', value: stats.female, filter: 'female' as const, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Bulls', value: stats.male, filter: 'male' as const, icon: Banknote, color: 'text-amber-600' },
    { label: 'Active', value: stats.active, filter: 'active' as const, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'Pregnant', value: stats.pregnant, filter: 'pregnant' as const, icon: Activity, color: 'text-blue-600' },
    { label: 'Dry', value: stats.dry, filter: 'dry' as const, icon: Info, color: 'text-amber-600' },
    { label: 'Calves', value: stats.calf, filter: 'calf' as const, icon: Baby, color: 'text-pink-600' },
    { label: 'Sold', value: stats.sold, filter: 'sold' as const, icon: Banknote, color: 'text-purple-600' },
  ];

  const filteredCows = cows.filter(cow => {
    const matchesSearch = cow.name.toLowerCase().includes(search.toLowerCase()) || cow._id.toLowerCase().includes(search.toLowerCase());
    let matchesFilter = true;
    if (statusFilter === 'female') matchesFilter = cow.gender !== 'male';
    else if (statusFilter === 'male') matchesFilter = cow.gender === 'male';
    else if (statusFilter !== 'all') matchesFilter = cow.status === statusFilter;
    const matchesBatch = !batchFilter || cow.batch === batchFilter;
    return matchesSearch && matchesFilter && matchesBatch;
  });

  const activeMothers = cows.filter(c => (c.status === 'active' || c.status === 'dry') && c.gender !== 'male');

  return (
    <div className="space-y-6 tab-panel">
      {/* ── Clickable Stat Cards ──────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {statCards.map((card) => {
          const isActive = statusFilter === card.filter;
          return (
            <button key={card.filter} onClick={() => setStatusFilter(isActive ? 'all' : card.filter)}
              className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm p-3 text-left transition-all cursor-pointer ${
                isActive ? 'border-teal-500 ring-2 ring-teal-500/20 dark:border-teal-400' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}>
              <p className="text-slate-500 dark:text-slate-400 text-[10px]">{card.label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{card.value}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <input type="text" placeholder="Search by name or ID..." className="w-full md:w-64 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-teal-500" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 w-full md:w-auto">
          {batches.length > 0 && (
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {isAdmin && (
            <>
              <button onClick={() => { setShowCalfForm(true); setShowForm(false); }} className="bg-pink-100 hover:bg-pink-200 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
                <Baby className="h-4 w-4" /> Add Calf
              </button>
              <button onClick={() => { setShowForm(true); setShowCalfForm(false); }} className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" /> Add Animal
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Add/Edit Form ─────────────────────── */}
      {showForm && (
        <div ref={formRef} className="bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-900/30 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">{editingCow ? 'Edit Animal' : 'Add New Animal'}</h3>
            <button onClick={() => { setShowForm(false); resetForm(); }}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Name *" children={<input required className="inp" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />} />
            <Field label="Breed *" children={<input required className="inp" value={formData.breed} onChange={e => setFormData({ ...formData, breed: e.target.value })} />} />
            <Field label="Gender" children={
              <select className="inp" value={formData.gender || 'female'} onChange={e => setFormData({ ...formData, gender: e.target.value as 'female' | 'male' })}>
                <option value="female">Female (Cow)</option>
                <option value="male">Male (Bull)</option>
              </select>
            } />
            <Field label="Status" children={
              <select className="inp" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as CowStatus })}>
                <option value="active">Active</option>
                {formData.gender !== 'male' && <><option value="dry">Dry</option><option value="pregnant">Pregnant</option></>}
                <option value="inactive">Inactive</option>
              </select>
            } />
            <Field label="Birth Date" children={<input type="date" className="inp" value={formData.birthDate} onChange={e => setFormData({ ...formData, birthDate: e.target.value })} />} />
            <Field label="Weight (kg)" children={<input type="number" className="inp" value={formData.weight || ''} onChange={e => setFormData({ ...formData, weight: parseFloat(e.target.value) || undefined })} />} />
            <Field label="Purchase Price (₨)" children={<input type="number" className="inp" placeholder="e.g. 150000" value={formData.purchasePrice || ''} onChange={e => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })} />} />
            {formData.gender !== 'male' && (
              <>
                <Field label="Lactation #" children={<input type="number" className="inp" value={formData.lactationNumber || 0} onChange={e => setFormData({ ...formData, lactationNumber: parseInt(e.target.value) || 0 })} />} />
                <Field label="Calving Date" children={<input type="date" className="inp" value={formData.calvingDate} onChange={e => setFormData({ ...formData, calvingDate: e.target.value })} />} />
                <Field label="Pregnancy Date" children={<input type="date" className="inp" value={formData.pregnancyDate} onChange={e => setFormData({ ...formData, pregnancyDate: e.target.value })} />} />
              </>
            )}
            <Field label="Batch" children={<input className="inp" placeholder="e.g. Jan 2026 Batch" value={formData.batch} onChange={e => setFormData({ ...formData, batch: e.target.value })} />} />
            <Field label="Image URL" children={<input className="inp" placeholder="Paste image link..." value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />} />
            <div className="md:col-span-3"><Field label="Notes" children={<textarea rows={2} className="inp" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />} /></div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
              <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Save className="h-4 w-4" /> {editingCow ? 'Update' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Add Calf Form ─────────────────────── */}
      {showCalfForm && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-pink-200 dark:border-pink-900/30 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Baby className="w-5 h-5 text-pink-600" /> Add Calf</h3>
            <button onClick={() => setShowCalfForm(false)}><X className="h-5 w-5 text-slate-400" /></button>
          </div>
          <form onSubmit={handleAddCalf} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Calf Name *" children={<input required className="inp" value={calfForm.name} onChange={e => setCalfForm({ ...calfForm, name: e.target.value })} />} />
            <Field label="Gender *" children={
              <select required className="inp" value={calfForm.gender} onChange={e => setCalfForm({ ...calfForm, gender: e.target.value as 'female' | 'male' })}>
                <option value="female">Female (Heifer)</option>
                <option value="male">Male (Bull calf)</option>
              </select>
            } />
            <Field label="Mother Cow *" children={
              <select required className="inp" value={calfForm.motherId} onChange={e => setCalfForm({ ...calfForm, motherId: e.target.value })}>
                <option value="">Select mother</option>
                {activeMothers.map(c => <option key={c._id} value={c._id}>{c.name} ({c.breed})</option>)}
              </select>
            } />
            <Field label="Breed (auto from mother)" children={<input className="inp" placeholder="Auto if blank" value={calfForm.breed} onChange={e => setCalfForm({ ...calfForm, breed: e.target.value })} />} />
            <Field label="Birth Date *" children={<input type="date" required className="inp" value={calfForm.birthDate} onChange={e => setCalfForm({ ...calfForm, birthDate: e.target.value })} />} />
            <Field label="Weight (kg)" children={<input type="number" className="inp" value={calfForm.weight} onChange={e => setCalfForm({ ...calfForm, weight: e.target.value })} />} />
            <Field label="Purchase Price (₨)" children={<input type="number" className="inp" placeholder="e.g. 50000" value={calfForm.purchasePrice} onChange={e => setCalfForm({ ...calfForm, purchasePrice: e.target.value })} />} />
            <Field label="Nursing Period (months)" children={<input type="number" step="0.5" className="inp" value={calfForm.nursingMonths} onChange={e => setCalfForm({ ...calfForm, nursingMonths: parseFloat(e.target.value) || 2.5 })} />} />
            <div className="md:col-span-3"><Field label="Notes" children={<textarea rows={2} className="inp" value={calfForm.notes} onChange={e => setCalfForm({ ...calfForm, notes: e.target.value })} />} /></div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCalfForm(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Baby className="h-4 w-4" /> Add Calf</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Table ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Breed</th>
                <th className="px-5 py-3">Gender</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Batch</th>
                <th className="px-5 py-3">Mother</th>
                <th className="px-5 py-3">Weight</th>
                <th className="px-5 py-3 text-right">Purchase</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">Loading...</td></tr>
              ) : filteredCows.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-slate-400">No animals found</td></tr>
              ) : (
                filteredCows.map(cow => {
                  const mother = cow.motherId ? cows.find(c => c._id === cow.motherId) : null;
                  const isMale = cow.gender === 'male';
                  return (
                    <tr key={cow._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <CowImg src={cow.image} name={cow.name} />
                          <div>
                            <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{cow.name}</p>
                            {cow.isCalf && <span className="text-[10px] text-pink-500">(calf)</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{cow.breed}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isMale ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                                 : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                        }`}>
                          {isMale ? '🐂 Bull' : '🐄 Cow'}
                        </span>
                      </td>
                      <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[cow.status]}`}>{cow.status}</span></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{cow.batch || '-'}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{mother ? mother.name : '-'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-400">{cow.weight ? `${fmt(cow.weight)} kg` : '-'}</td>
                      <td className="px-5 py-3 text-sm text-amber-600 text-right">{cow.purchasePrice ? fmtPKR(cow.purchasePrice) : '-'}</td>
                      <td className="px-5 py-3 text-right">
                        {isAdmin && (
                          <div className="flex justify-end gap-1.5">
                            {cow.status !== 'sold' && (
                              <button onClick={() => setSaleCow(cow)} className="p-1.5 text-slate-400 hover:text-purple-600" title="Record Sale"><Banknote className="h-4 w-4" /></button>
                            )}
                            <button onClick={() => handleEdit(cow)} className="p-1.5 text-slate-400 hover:text-teal-600" title="Edit"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(cow._id)} className="p-1.5 text-slate-400 hover:text-red-500" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sale Modal ────────────────────────── */}
      <AnimatePresence>
      {saleCow && (
        <ViewportModal
          onClose={() => setSaleCow(null)}
          panelClassName="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg p-6 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Record Sale — {saleCow.name} {saleCow.gender === 'male' ? '🐂' : '🐄'}</h3>
            <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setSaleCow(null)}><X className="h-5 w-5 text-slate-400" /></motion.button>
          </div>
          <form onSubmit={handleRecordSale} className="space-y-4">
            <Field label="Sale Date *" children={<input required type="date" className="inp" value={saleForm.date} onChange={e => setSaleForm({ ...saleForm, date: e.target.value })} />} />
            <Field label="Sale Price (₨) *" children={<input required type="number" min="1" className="inp" value={saleForm.salePrice} onChange={e => setSaleForm({ ...saleForm, salePrice: e.target.value })} />} />
            <Field label="Buyer" children={<input className="inp" value={saleForm.buyer} onChange={e => setSaleForm({ ...saleForm, buyer: e.target.value })} />} />
            <Field label="Notes" children={<textarea rows={2} className="inp" value={saleForm.notes} onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })} />} />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setSaleCow(null)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
              <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-2 text-sm font-medium flex items-center gap-2"><Banknote className="h-4 w-4" /> Record Sale</button>
            </div>
          </form>
        </ViewportModal>
      )}
      </AnimatePresence>

      <style>{`.inp{width:100%;border:1px solid #e2e8f0;border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;background:white;outline:none}.inp:focus{border-color:#14b8a6}.dark .inp{background:#0f172a;border-color:#334155;color:#e2e8f0}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-stone-500 dark:text-stone-400 text-xs">{label}</label>{children}</div>;
}

function CowImg({ src, name, size = 'w-8 h-8' }: { src?: string; name: string; size?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return <div className={`${size} rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-sm shrink-0`}>🐄</div>;
  }
  return <img src={src} alt={name} className={`${size} rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0`} onError={() => setBroken(true)} />;
}
