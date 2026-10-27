import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Utensils,
  TrendingDown,
  DollarSign,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  History,
  Calendar,
  X,
  Package
} from 'lucide-react';
import { api } from '../services/api';
import { ProductWastePrepConsumedItem, ProductWastePrepConsumedResponse } from '../types';

interface ProductWastePrepConsumedAuditProps {
  selectedCafeteria?: string;
  initialSearch?: string;
}

export const ProductWastePrepConsumedAudit: React.FC<ProductWastePrepConsumedAuditProps> = ({
  selectedCafeteria,
  initialSearch = '',
}) => {
  const [data, setData] = useState<ProductWastePrepConsumedResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>(initialSearch);
  const [category, setCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('wasted_qty');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    api.getProductWastePrepConsumed({
      cafeteria_id: selectedCafeteria || undefined,
      search: search.trim() || undefined,
      category: category !== 'All' ? category : undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    })
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Failed to load product waste and prep audit:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [selectedCafeteria, search, category, sortBy, sortOrder]);

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedItemId((prev) => (prev === id ? null : id));
  };

  const categories = ['All', 'Grains', 'Proteins', 'Soups', 'Salads', 'Bakery', 'Desserts'];

  return (
    <div className="card p-0 overflow-hidden space-y-0">
      {/* Header Banner */}
      <div className="p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
              <Trash2 className="w-5 h-5" />
            </span>
            <h2 className="font-bold text-base sm:text-lg text-slate-900">
              Product Food Flow Audit: Waste, Preparation & Consumption
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search any product by <span className="font-semibold text-slate-700">Product Name</span> or{' '}
            <span className="font-semibold text-slate-700">Product ID</span> to audit total prepared, consumed, and wasted volumes.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>{loading ? 'Refreshing...' : 'Refresh Audit'}</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-slate-50/50 border-b border-slate-200">
          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-soft-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Prepared</span>
              <Utensils className="w-3.5 h-3.5 text-forest-700" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {data.total_prepared_qty.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Sum across products</span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-soft-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Consumed</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 tracking-tight">
              {data.total_consumed_qty.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, data.overall_consumption_efficiency_pct)}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 whitespace-nowrap">
                {data.overall_consumption_efficiency_pct}%
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-soft-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Wasted</span>
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-rose-600 tracking-tight">
              {data.total_wasted_qty.toLocaleString()}
            </div>
            <span className="text-[10px] font-semibold text-rose-600 mt-0.5 block">
              {data.overall_waste_pct}% waste rate
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-soft-sm">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Financial Loss</span>
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              ${data.total_waste_cost.toLocaleString()}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Ingredient procurement loss</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center gap-3">
        {/* Search input: handles name or ID */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by product name or product ID (e.g. ITEM-DINNER-ROLLS, Steamed Jasmine Rice)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs sm:text-sm pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-forest-800 text-white shadow-soft-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <ArrowUpDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={`${sortBy}_${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split('_');
              setSortBy(sb);
              setSortOrder(so);
            }}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-forest-500 w-full sm:w-auto cursor-pointer"
          >
            <option value="wasted_qty_desc">Sort: Highest Waste First</option>
            <option value="prepared_qty_desc">Sort: Highest Prepared First</option>
            <option value="consumed_qty_desc">Sort: Highest Consumed First</option>
            <option value="waste_cost_desc">Sort: Highest Cost Loss First</option>
            <option value="food_name_asc">Sort: Product Name (A-Z)</option>
            <option value="food_item_id_asc">Sort: Product ID</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Product ID</th>
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-right">Total Prepared</th>
              <th className="py-3 px-4 text-right">Total Consumed</th>
              <th className="py-3 px-4 text-right">Total Wasted</th>
              <th className="py-3 px-4 text-right">Leftovers</th>
              <th className="py-3 px-4 text-right">Waste Cost ($)</th>
              <th className="py-3 px-4 text-center">Efficiency Rating</th>
              <th className="py-3 px-4 text-center">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-forest-300 border-t-forest-700 rounded-full animate-spin"></div>
                    <span>Auditing product waste, preparation, and consumption records...</span>
                  </div>
                </td>
              </tr>
            ) : !data || data.products.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-400">
                  No products matched your search "{search}". Try searching by ID (e.g. ITEM-DINNER-ROLLS) or name.
                </td>
              </tr>
            ) : (
              data.products.map((item) => {
                const isExpanded = expandedItemId === item.food_item_id;
                return (
                  <React.Fragment key={item.food_item_id}>
                    <tr
                      onClick={() => toggleExpand(item.food_item_id)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-forest-50/30' : ''
                      }`}
                    >
                      {/* Product ID */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          <span>{item.food_item_id}</span>
                          <button
                            onClick={(e) => handleCopyId(item.food_item_id, e)}
                            title="Copy Product ID"
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                          >
                            {copiedId === item.food_item_id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">{item.food_name}</td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-600">{item.category}</td>

                      {/* Total Prepared */}
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">
                        {item.total_prepared_qty.toLocaleString()} {item.unit}
                      </td>

                      {/* Total Consumed */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-emerald-700">
                          {item.total_consumed_qty.toLocaleString()} {item.unit}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {item.consumption_efficiency_pct}% consumed
                        </span>
                      </td>

                      {/* Total Wasted */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-rose-600">
                          {item.total_wasted_qty.toLocaleString()} {item.unit}
                        </div>
                        <span className="text-[10px] font-semibold text-rose-500">
                          {item.waste_pct}% waste
                        </span>
                      </td>

                      {/* Total Leftovers */}
                      <td className="py-3 px-4 text-right text-slate-600">
                        {item.total_leftover_qty.toLocaleString()} {item.unit}
                      </td>

                      {/* Financial Cost */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        ${item.total_waste_cost.toFixed(2)}
                      </td>

                      {/* Efficiency Rating */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`badge text-[10px] uppercase font-bold ${
                            item.status_level === 'optimal'
                              ? 'badge-success'
                              : item.status_level === 'moderate_waste'
                              ? 'badge-warning'
                              : 'badge-danger'
                          }`}
                        >
                          {item.status_level === 'optimal'
                            ? 'Optimal'
                            : item.status_level === 'moderate_waste'
                            ? 'Moderate'
                            : 'High Waste'}
                        </span>
                      </td>

                      {/* Expand Button */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(item.food_item_id);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-forest-700 hover:bg-slate-100 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-forest-700" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Daily History Subtable */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={10} className="p-4">
                          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-soft-sm space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                <History className="w-4 h-4 text-forest-700" />
                                <span>Recent Service Date Breakdown for {item.food_name} ({item.food_item_id})</span>
                              </span>
                              <span className="text-slate-400">
                                {item.records_count} total service logs in database
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">Service Date</th>
                                    <th className="py-2 px-3">Facility</th>
                                    <th className="py-2 px-3 text-right">Prepared</th>
                                    <th className="py-2 px-3 text-right">Consumed</th>
                                    <th className="py-2 px-3 text-right">Leftovers</th>
                                    <th className="py-2 px-3 text-right">Wasted</th>
                                    <th className="py-2 px-3 text-right">Waste Cost ($)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {item.recent_history.map((rec, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-slate-50/50">
                                      <td className="py-2 px-3 font-mono font-medium text-slate-700">
                                        {rec.date}
                                      </td>
                                      <td className="py-2 px-3 text-slate-600">{rec.cafeteria_id}</td>
                                      <td className="py-2 px-3 text-right font-semibold text-slate-800">
                                        {rec.prepared_qty} {item.unit}
                                      </td>
                                      <td className="py-2 px-3 text-right font-semibold text-emerald-700">
                                        {rec.consumed_qty} {item.unit}
                                      </td>
                                      <td className="py-2 px-3 text-right text-slate-600">
                                        {rec.leftover_qty} {item.unit}
                                      </td>
                                      <td className="py-2 px-3 text-right font-bold text-rose-600">
                                        {rec.wasted_qty} {item.unit}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-800">
                                        ${rec.waste_cost.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
