import React, { useState, useEffect } from 'react';
import {
  Trash2,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Plus,
  ShieldCheck,
  CheckCircle2,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie
} from 'recharts';
import { api } from '../services/api';
import { WasteAnalytics, FoodItem, Cafeteria } from '../types';
import { ProductWastePrepConsumedAudit } from '../components/ProductWastePrepConsumedAudit';

interface WasteAnalyticsPageProps {
  selectedCafeteria: string;
}

const REASON_COLORS: Record<string, string> = {
  overpreparation: '#dc2626',
  expired: '#d97706',
  handling: '#0284c7',
  plate_waste: '#7c3aed',
};

export const WasteAnalyticsPage: React.FC<WasteAnalyticsPageProps> = ({ selectedCafeteria }) => {
  const [data, setData] = useState<WasteAnalytics | null>(null);
  const [foodCatalog, setFoodCatalog] = useState<FoodItem[]>([]);
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);

  // Log form fields
  const [logCafeteriaId, setLogCafeteriaId] = useState<string>(selectedCafeteria || 'CAF-CENTRAL');
  const [logFoodItemId, setLogFoodItemId] = useState<string>('ITEM-JASMINE-RICE');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logQty, setLogQty] = useState<number>(5.0);
  const [logReason, setLogReason] = useState<string>('overpreparation');
  const [logNotes, setLogNotes] = useState<string>('');
  const [logError, setLogError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getWasteAnalytics(selectedCafeteria),
      api.getFoodItems(),
      api.getCafeterias(),
    ])
      .then(([analytics, foods, cafs]) => {
        setData(analytics);
        setFoodCatalog(foods);
        setCafeterias(cafs);
      })
      .catch((err) => console.error('Failed to load waste analytics:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedCafeteria]);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError(null);
    try {
      const food = foodCatalog.find((f) => f.id === logFoodItemId);
      await api.logWasteRecord({
        cafeteria_id: logCafeteriaId,
        food_item_id: logFoodItemId,
        record_date: logDate,
        wasted_qty: logQty,
        unit: food?.unit || 'kg',
        waste_reason: logReason,
        unit_cost: food?.unit_cost || 2.50,
        is_preventable: true,
        notes: logNotes,
      });

      setIsLogModalOpen(false);
      loadData();
    } catch (err: any) {
      setLogError(err.message || 'Failed to log waste record');
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-forest-200 border-t-forest-700 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Calculating food waste loss metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Food Waste Analytics & Loss Prevention</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Identify waste root causes, calculate financial ingredient loss, and pinpoint preventable over-preparation.
          </p>
        </div>

        <button
          onClick={() => {
            setLogError(null);
            setIsLogModalOpen(true);
          }}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log Waste Incident</span>
        </button>
      </div>

      {/* Top 3 High-Impact KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Food Wasted</span>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
                <Trash2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {data.total_waste_qty.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500">kg recorded</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Across tracked cafeteria meal periods
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Financial Loss</span>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                ${data.total_waste_cost.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-slate-500">ingredient value</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Direct procurement expense forfeited
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Preventable Waste %</span>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-700 tracking-tight">
                {data.preventable_waste_pct}%
              </span>
              <span className="text-xs font-medium text-slate-500">addressable</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Recoverable via demand optimization</span>
            </p>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Waste Timeline Trend (2 cols) */}
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-base text-slate-900">Historical Waste Loss Timeline</h2>
                <p className="text-xs text-slate-500">14-day record of physical waste (kg) vs monetary cost ($)</p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="wasted_qty" name="Wasted Qty (kg)" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="cost" name="Financial Loss ($)" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Waste Reasons Distribution (1 col) */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-base text-slate-900">Waste by Root Cause</h2>
                <p className="text-xs text-slate-500">Why food is discarded</p>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.waste_by_reason}
                    dataKey="wasted_qty"
                    nameKey="reason"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={45}
                    paddingAngle={3}
                  >
                    {data.waste_by_reason.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={REASON_COLORS[entry.reason] || '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${val} kg`, 'Wasted']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
              {data.waste_by_reason.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: REASON_COLORS[r.reason] || '#64748b' }}
                  ></span>
                  <span className="text-slate-600 capitalize">{r.reason.replace('_', ' ')}:</span>
                  <span className="font-bold text-slate-900">{r.wasted_qty} kg</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Product Food Flow Audit: Waste, Preparation & Consumption */}
      <ProductWastePrepConsumedAudit selectedCafeteria={selectedCafeteria} />

      {/* Top 8 Food Items by Waste Loss */}
      {data && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base text-slate-900">Highest Waste Impact Menu Items</h2>
              <p className="text-xs text-slate-500">Prioritize these items for demand buffer recalibration</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Menu Item</th>
                  <th className="py-2.5 px-4 text-right">Cumulative Wasted</th>
                  <th className="py-2.5 px-4 text-right">Financial Loss ($)</th>
                  <th className="py-2.5 px-4 text-center">Prevention Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.waste_by_item.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{item.food_name}</td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">{item.wasted_qty} {item.unit}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">${item.financial_cost.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="badge badge-warning text-[10px]">
                        Save ~${(item.financial_cost * 0.75).toFixed(0)} with AI forecast
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Waste Incident Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-soft-lg space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Log Kitchen Waste Incident</h3>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="waste-cafeteria" className="block text-xs font-semibold text-slate-700 mb-1">Cafeteria</label>
                  <select
                    id="waste-cafeteria"
                    value={logCafeteriaId}
                    onChange={(e) => setLogCafeteriaId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    {cafeterias.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="waste-food-item" className="block text-xs font-semibold text-slate-700 mb-1">Food Item</label>
                  <select
                    id="waste-food-item"
                    value={logFoodItemId}
                    onChange={(e) => setLogFoodItemId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    {foodCatalog.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.unit})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="waste-date" className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    id="waste-date"
                    type="date"
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label htmlFor="waste-qty" className="block text-xs font-semibold text-slate-700 mb-1">Wasted Qty</label>
                  <input
                    id="waste-qty"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={logQty}
                    onChange={(e) => setLogQty(Number(e.target.value))}
                    required
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label htmlFor="waste-reason" className="block text-xs font-semibold text-slate-700 mb-1">Waste Reason</label>
                  <select
                    id="waste-reason"
                    value={logReason}
                    onChange={(e) => setLogReason(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2"
                  >
                    <option value="overpreparation">Overpreparation</option>
                    <option value="expired">Expired Safe-Time</option>
                    <option value="handling">Handling Damage</option>
                    <option value="plate_waste">Plate Return Waste</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="waste-notes" className="block text-xs font-semibold text-slate-700 mb-1">Operational Notes</label>
                <textarea
                  id="waste-notes"
                  rows={2}
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Root cause notes for waste audit..."
                  className="w-full text-xs border border-slate-200 rounded-lg p-2"
                />
              </div>

              {logError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {logError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Waste Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
