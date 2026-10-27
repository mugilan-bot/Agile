import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Users,
  Utensils,
  TrendingUp,
  CloudSun,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  DollarSign,
  Package,
  Layers,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import { NextDayDinerRecommendation, NextDayPrepPlan, Cafeteria } from '../types';

interface NextDayDinnerRecommenderProps {
  selectedCafeteria: string;
  onApplyDinersToSimulator?: (dinerCount: number, targetDate: string) => void;
  onSimulateItem?: (itemId: string, targetDate: string, dinerCount: number) => void;
}

export const NextDayDinnerRecommender: React.FC<NextDayDinnerRecommenderProps> = ({
  selectedCafeteria,
  onApplyDinersToSimulator,
  onSimulateItem,
}) => {
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [cafeteriaId, setCafeteriaId] = useState<string>(selectedCafeteria || 'CAF-CENTRAL');
  const [targetDate, setTargetDate] = useState<string>(getTomorrowDate());
  const [weatherCondition, setWeatherCondition] = useState<string>('Sunny');
  const [temperatureC, setTemperatureC] = useState<number>(22.0);
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [isSpecialEvent, setIsSpecialEvent] = useState<boolean>(false);
  const [safetyBufferPct, setSafetyBufferPct] = useState<number>(0.10);

  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [dinerRec, setDinerRec] = useState<NextDayDinerRecommendation | null>(null);
  const [prepPlan, setPrepPlan] = useState<NextDayPrepPlan | null>(null);
  const [loadingDiners, setLoadingDiners] = useState<boolean>(false);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table filters
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (selectedCafeteria) {
      setCafeteriaId(selectedCafeteria);
    }
  }, [selectedCafeteria]);

  useEffect(() => {
    api.getCafeterias()
      .then(setCafeterias)
      .catch((err) => console.error('Failed to load cafeterias:', err));
  }, []);

  // Fetch next-day diner recommendation whenever parameters change
  useEffect(() => {
    let mounted = true;
    setLoadingDiners(true);
    setError(null);

    api.getNextDayDiners({
      cafeteria_id: cafeteriaId,
      target_date: targetDate,
      weather_condition: weatherCondition,
      temperature_c: temperatureC,
      is_holiday: isHoliday,
      is_special_event: isSpecialEvent,
    })
      .then((data) => {
        if (mounted) {
          setDinerRec(data);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Error fetching next-day diners:', err);
          setError(err.message || 'Failed to calculate expected diners.');
        }
      })
      .finally(() => {
        if (mounted) setLoadingDiners(false);
      });

    return () => {
      mounted = false;
    };
  }, [cafeteriaId, targetDate, weatherCondition, temperatureC, isHoliday, isSpecialEvent]);

  // Load next-day complete dinner plan
  const loadNextDayPlan = () => {
    setLoadingPlan(true);
    setError(null);

    api.getNextDayDinnerPlan({
      cafeteria_id: cafeteriaId,
      target_date: targetDate,
      weather_condition: weatherCondition,
      temperature_c: temperatureC,
      is_holiday: isHoliday,
      is_special_event: isSpecialEvent,
      safety_buffer_pct: safetyBufferPct,
    })
      .then((data) => {
        setPrepPlan(data);
      })
      .catch((err) => {
        console.error('Failed to load next-day plan:', err);
        setError(err.message || 'Failed to generate dinner preparation plan.');
      })
      .finally(() => {
        setLoadingPlan(false);
      });
  };

  // Automatically load the plan on initial mount or cafeteria switch
  useEffect(() => {
    loadNextDayPlan();
  }, [cafeteriaId, targetDate]);

  // Filtered items
  const filteredItems = (prepPlan?.items || []).filter((item) => {
    const matchesCategory = categoryFilter === 'All' || item.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      item.food_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.food_item_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Grains', 'Proteins', 'Soups', 'Salads', 'Bakery', 'Desserts'];

  return (
    <div className="space-y-6">
      {/* Hero Banner: Tomorrow's Expected Diners & Dinner Forecast */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-forest-800 via-forest-700 to-forest-900 text-white p-6 sm:p-8 shadow-soft-lg">
        <div className="absolute top-0 right-0 -translate-y-8 translate-x-12 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-300 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>AI Next-Day Dining Intelligence</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Recommended Dinners & Diners for Next Day
            </h2>
            <p className="text-sm text-emerald-100/90 leading-relaxed">
              Forecast expected diner footfall for tomorrow, calculate optimal dinner preparation quantities,
              deduct usable kitchen stock, and safeguard against food over-preparation.
            </p>
          </div>

          {/* Quick Scenario Selectors */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 self-start lg:self-auto text-xs">
            <div>
              <label className="block text-emerald-200 font-medium mb-1">Target Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-white text-slate-900 rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-emerald-200 font-medium mb-1">Facility</label>
              <select
                value={cafeteriaId}
                onChange={(e) => setCafeteriaId(e.target.value)}
                className="bg-white text-slate-900 rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none"
              >
                {cafeterias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-emerald-200 font-medium mb-1">Weather</label>
              <select
                value={weatherCondition}
                onChange={(e) => setWeatherCondition(e.target.value)}
                className="bg-white text-slate-900 rounded-lg px-2.5 py-1.5 font-semibold focus:outline-none"
              >
                <option value="Sunny">Sunny</option>
                <option value="Rainy">Rainy</option>
                <option value="Cloudy">Cloudy</option>
                <option value="Cold">Cold</option>
              </select>
            </div>
          </div>
        </div>

        {/* Expected Diners Highlight Card & Factors */}
        {dinerRec && (
          <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <span className="text-xs uppercase tracking-wider text-emerald-200 font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-300" />
                <span>Recommended Expected Diners</span>
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-white tracking-tight">
                  {loadingDiners ? '...' : dinerRec.recommended_customer_count.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-emerald-200">diners</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-emerald-200">
                <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-medium">
                  {dinerRec.day_of_week}
                </span>
                <span>• {dinerRec.confidence_score}% Confidence</span>
              </div>
              {onApplyDinersToSimulator && (
                <button
                  onClick={() => onApplyDinersToSimulator(dinerRec.recommended_customer_count, dinerRec.target_date)}
                  className="mt-3 w-full py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Fill Simulator with This Count</span>
                </button>
              )}
            </div>

            <div className="md:col-span-2 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-200 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Diner Calculation Explanation</span>
                </span>
                <p className="text-xs text-white/95 mt-1.5 leading-relaxed font-medium">
                  {dinerRec.explanation}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/10 text-[11px]">
                {dinerRec.factors.map((f, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-2">
                    <span className="text-emerald-300 font-semibold block truncate">{f.factor}</span>
                    <span className="text-white font-medium block">{f.impact}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Strip for Next-Day Dinner Preparation */}
      {prepPlan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Expected Diners</span>
              <Users className="w-4 h-4 text-forest-700" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {prepPlan.expected_customer_count.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {prepPlan.day_of_week} at {prepPlan.cafeteria_name}
            </span>
          </div>

          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Dinners to Prep</span>
              <Utensils className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {prepPlan.total_recommended_prep.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Across all menu items (portions/kg)
            </span>
          </div>

          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Usable Stock Offset</span>
              <Package className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {prepPlan.total_usable_inventory.toLocaleString()}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
              Saved from re-cooking
            </span>
          </div>

          <div className="card">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Est. Preparation Cost</span>
              <DollarSign className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              ${prepPlan.total_estimated_prep_cost.toLocaleString()}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Target ingredient expense
            </span>
          </div>
        </div>
      )}

      {/* Product-by-Product Next-Day Dinner Preparation Schedule Table */}
      <div className="card p-0 overflow-hidden space-y-0">
        {/* Table Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-forest-700" />
              <span>Next-Day Dinner Preparation Schedule by Product</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Recommended dinner preparation amounts for tomorrow ({prepPlan?.target_date || targetDate})
              calibrated to expected diner count.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={loadNextDayPlan}
              disabled={loadingPlan}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-forest-700" />
              <span>{loadingPlan ? 'Recalculating...' : 'Refresh Schedule'}</span>
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product name or product ID (e.g. ITEM-DINNER-ROLLS, Jasmine)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs sm:text-sm pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-forest-800 text-white shadow-soft-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Product ID</th>
                <th className="py-3 px-4">Food Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Predicted Demand</th>
                <th className="py-3 px-4 text-right">Usable Stock</th>
                <th className="py-3 px-4 text-right bg-emerald-50/70 text-emerald-900">
                  Recommended Prep (Dinners)
                </th>
                <th className="py-3 px-4 text-center">Surplus Risk</th>
                <th className="py-3 px-4 text-right">Est. Cost</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingPlan ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-forest-300 border-t-forest-700 rounded-full animate-spin"></div>
                      <span>Calculating optimal dinner quantities for tomorrow...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No products match the search filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.food_item_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px]">
                        {item.food_item_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{item.food_name}</td>
                    <td className="py-3 px-4 text-slate-600">{item.category}</td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      {item.predicted_demand} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-500">
                      {item.existing_usable_inventory > 0 ? (
                        <span className="text-blue-700 font-semibold">
                          {item.existing_usable_inventory} {item.unit}
                        </span>
                      ) : (
                        <span className="text-slate-400">0 {item.unit}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-700 bg-emerald-50/40 text-sm">
                      {item.recommended_prep} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`badge text-[10px] uppercase font-bold ${
                          item.surplus_risk_level === 'low'
                            ? 'badge-success'
                            : item.surplus_risk_level === 'medium'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {item.surplus_risk_level} risk
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                      ${item.estimated_prep_cost.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {onSimulateItem && (
                        <button
                          onClick={() =>
                            onSimulateItem(
                              item.food_item_id,
                              prepPlan?.target_date || targetDate,
                              prepPlan?.expected_customer_count || 1000
                            )
                          }
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-forest-50 text-forest-700 hover:bg-forest-100 border border-forest-200 transition-colors inline-flex items-center gap-1"
                        >
                          <span>Simulate</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
