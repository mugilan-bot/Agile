import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Package,
  Trash2,
  DollarSign,
  HeartHandshake,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Info,
  Layers,
  Utensils
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';
import { api } from '../services/api';
import { DashboardSummary } from '../types';

interface DashboardPageProps {
  selectedCafeteria: string;
}

const CATEGORY_COLORS = ['#15803d', '#059669', '#0284c7', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

export const DashboardPage: React.FC<DashboardPageProps> = ({ selectedCafeteria }) => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.getDashboardSummary(selectedCafeteria)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, [selectedCafeteria]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-forest-200 border-t-forest-700 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Loading operations and prediction analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
        <div className="flex items-center gap-2 font-semibold text-base mb-1">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Failed to load dashboard</span>
        </div>
        <p className="text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Metadata Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time food production, AI demand predictions, waste risk auditing, and surplus redistribution metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 shadow-soft-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Data Source: <strong>{data.is_synthetic ? 'Synthetic Benchmark (5,000 Records)' : 'Live Operational Data'}</strong></span>
          </div>
        </div>
      </div>

      {/* Operational Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.alerts.slice(0, 2).map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border flex items-start gap-3 transition-all shadow-soft-sm ${
                alert.severity === 'warning'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : alert.severity === 'info'
                  ? 'bg-sky-50/80 border-sky-200 text-sky-900'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              }`}
            >
              {alert.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
              {alert.severity === 'info' && <Info className="w-5 h-5 text-sky-600 flex-shrink-0 mt-0.5" />}
              {alert.severity === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider">{alert.title}</h2>
                <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 8 Core KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Forecast Demand */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Forecast Demand</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{data.forecast_demand_today.toLocaleString()}</span>
            <span className="text-xs font-medium text-slate-500">kg / day</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-forest-600" />
            <span>AI model prediction baseline</span>
          </p>
        </div>

        {/* KPI 2: Planned Preparation */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Planned Preparation</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{data.planned_preparation_today.toLocaleString()}</span>
            <span className="text-xs font-medium text-slate-500">kg planned</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span>Forecast + safety buffer</span>
          </p>
        </div>

        {/* KPI 3: Actual Consumption */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Actual Consumption</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{data.actual_consumption_today.toLocaleString()}</span>
            <span className="text-xs font-medium text-slate-500">kg consumed</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span>Diner participation rate: 91.4%</span>
          </p>
        </div>

        {/* KPI 4: Estimated Leftovers */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated Leftovers</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{data.estimated_leftovers_today.toLocaleString()}</span>
            <span className="text-xs font-medium text-slate-500">kg remaining</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span>Surplus earmarked for preservation</span>
          </p>
        </div>

        {/* KPI 5: Waste Percentage */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Waste Percentage</span>
            <div className={`p-2 rounded-lg ${data.waste_percentage > 8 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${data.waste_percentage > 8 ? 'text-rose-600' : 'text-slate-900'}`}>
              {data.waste_percentage}%
            </span>
            <span className="text-xs font-medium text-slate-500">of prep</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span>Target threshold: &lt; 8.0%</span>
          </p>
        </div>

        {/* KPI 6: Waste Financial Cost */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Financial Loss (Day)</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">${data.waste_cost_total.toLocaleString()}</span>
            <span className="text-xs font-medium text-slate-500">spoilage cost</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span>Valued at standard ingredient unit cost</span>
          </p>
        </div>

        {/* KPI 7: Surplus Available */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Surplus Available</span>
            <div className="p-2 rounded-lg bg-sky-50 text-sky-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{data.surplus_available_qty}</span>
            <span className="text-xs font-medium text-slate-500">kg ready</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            <span>Pending shelter/pantry pickup</span>
          </p>
        </div>

        {/* KPI 8: Successfully Redistributed */}
        <div className="card card-hover">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Redistributed</span>
            <div className="p-2 rounded-lg bg-forest-50 text-forest-700">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-forest-700 tracking-tight">{data.redistributed_food_qty}</span>
            <span className="text-xs font-medium text-slate-500">kg delivered</span>
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 text-emerald-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Diverted from landfills</span>
          </p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 cols) */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base text-slate-900">Production vs Consumption Trend</h2>
              <p className="text-xs text-slate-500">14-day chronological tracking of forecast, actual prep, diners consumed, and waste</p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              Chronological Time Series
            </span>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.predicted_vs_actual_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="prepColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#15803d" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#15803d" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="consColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="planned_prep" name="Planned Prep (kg)" stroke="#15803d" strokeWidth={2} fillOpacity={1} fill="url(#prepColor)" />
                <Area type="monotone" dataKey="actual_consumption" name="Consumed (kg)" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#consColor)" />
                <Area type="monotone" dataKey="waste" name="Waste (kg)" stroke="#ef4444" strokeWidth={1.5} fill="#fee2e2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waste By Category (1 col) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base text-slate-900">Waste by Category</h2>
              <p className="text-xs text-slate-500">Distribution of food waste losses</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.waste_by_category} layout="vertical" margin={{ top: 5, right: 20, left: 25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: '#334155' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [`${val} kg`, 'Wasted Quantity']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="wasted_qty" fill="#15803d" radius={[0, 4, 4, 0]}>
                  {data.waste_by_category.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* High-Risk Food Items & Recent Pipeline Ingestion Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* High Risk Items Table (2 cols) */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base text-slate-900">High-Waste Risk Items</h2>
              <p className="text-xs text-slate-500">Food items with elevated leftover waste requiring preparation adjustment</p>
            </div>
            <span className="badge badge-warning flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Inspection Priority</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Food Item</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Prepared</th>
                  <th className="py-2.5 px-3 text-right">Wasted</th>
                  <th className="py-2.5 px-3 text-right">Waste %</th>
                  <th className="py-2.5 px-3 text-right">Financial Loss</th>
                  <th className="py-2.5 px-3 text-center">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.high_risk_items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-900">{item.food_name}</td>
                    <td className="py-3 px-3 text-slate-500">{item.category}</td>
                    <td className="py-3 px-3 text-right text-slate-700">{item.prepared_qty} {item.unit}</td>
                    <td className="py-3 px-3 text-right font-semibold text-rose-600">{item.wasted_qty} {item.unit}</td>
                    <td className="py-3 px-3 text-right font-medium text-slate-800">{item.waste_pct}%</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">${item.financial_cost.toFixed(2)}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`badge ${item.risk_level === 'High' ? 'badge-danger' : 'badge-warning'}`}>
                        {item.risk_level}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Pipeline Ingestion Runs (1 col) */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-base text-slate-900">Data Pipeline Runs</h2>
              <p className="text-xs text-slate-500">Recent automated ingestion activities</p>
            </div>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>

          <div className="space-y-3">
            {data.recent_pipeline_runs.map((run, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-800 truncate max-w-[150px]">
                    {run.execution_id}
                  </span>
                  <span className="badge badge-success text-[10px] uppercase">
                    {run.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span className="truncate max-w-[140px]">{run.filename}</span>
                  <span>{run.valid_records.toLocaleString()} rows</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Run time: {run.executed_at}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Local Validation Pipeline</span>
            <span className="text-forest-700 font-medium">Zero Data Loss</span>
          </div>
        </div>
      </div>
    </div>
  );
};
