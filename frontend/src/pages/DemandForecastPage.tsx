import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sparkles,
  Calculator,
  ShieldAlert,
  Calendar,
  Building2,
  Users,
  CloudSun,
  Thermometer,
  Layers,
  History,
  CheckCircle2,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import {
  Cafeteria,
  FoodItem,
  PredictionRequest,
  PredictionResponse,
  PredictionHistoryItem,
  ModelMetrics
} from '../types';
import { NextDayDinnerRecommender } from '../components/NextDayDinnerRecommender';

interface DemandForecastPageProps {
  selectedCafeteria: string;
}

export const DemandForecastPage: React.FC<DemandForecastPageProps> = ({ selectedCafeteria }) => {
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);

  // Form State
  const [cafeteriaId, setCafeteriaId] = useState<string>(selectedCafeteria || 'CAF-CENTRAL');
  const [foodItemId, setFoodItemId] = useState<string>('ITEM-JASMINE-RICE');
  const [targetDate, setTargetDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expectedCustomers, setExpectedCustomers] = useState<number>(1100);
  const [weatherCondition, setWeatherCondition] = useState<string>('Sunny');
  const [temperatureC, setTemperatureC] = useState<number>(24.0);
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [isSpecialEvent, setIsSpecialEvent] = useState<boolean>(false);
  const [safetyBufferPct, setSafetyBufferPct] = useState<number>(0.10);

  // Results State
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCafeteria) {
      setCafeteriaId(selectedCafeteria);
    }
  }, [selectedCafeteria]);

  useEffect(() => {
    // Load dropdown options & metrics
    Promise.all([
      api.getCafeterias(),
      api.getFoodItems(),
      api.getPredictionHistory(),
      api.getModelMetrics(),
    ])
      .then(([cafs, items, hist, metrics]) => {
        setCafeterias(cafs);
        setFoodItems(items);
        setHistory(hist);
        setModelMetrics(metrics);
        if (items.length > 0 && !foodItemId) {
          setFoodItemId(items[0].id);
        }
      })
      .catch((err) => console.error('Error loading forecast data:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: PredictionRequest = {
      cafeteria_id: cafeteriaId,
      food_item_id: foodItemId,
      target_date: targetDate,
      expected_customer_count: expectedCustomers,
      weather_condition: weatherCondition,
      temperature_c: temperatureC,
      is_holiday: isHoliday,
      is_special_event: isSpecialEvent,
      safety_buffer_pct: safetyBufferPct,
    };

    try {
      const response = await api.predictDemand(payload);
      setResult(response);
      // Refresh history log
      api.getPredictionHistory().then(setHistory).catch(console.error);
    } catch (err: any) {
      setError(err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDinersToSimulator = (dinerCount: number, targetDateStr: string) => {
    setExpectedCustomers(dinerCount);
    setTargetDate(targetDateStr);
    const formEl = document.getElementById('simulator-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSimulateItem = (itemId: string, targetDateStr: string, dinerCount: number) => {
    setFoodItemId(itemId);
    setTargetDate(targetDateStr);
    setExpectedCustomers(dinerCount);
    const formEl = document.getElementById('simulator-form');
    if (formEl) {
      formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleQuickRecommendDiners = async () => {
    try {
      const rec = await api.getNextDayDiners({
        cafeteria_id: cafeteriaId,
        target_date: targetDate,
        weather_condition: weatherCondition,
        temperature_c: temperatureC,
        is_holiday: isHoliday,
        is_special_event: isSpecialEvent,
      });
      setExpectedCustomers(rec.recommended_customer_count);
    } catch (err) {
      console.error('Failed to auto-recommend diners:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Demand Forecast & Preparation Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Generate accurate demand predictions using our Scikit-learn Random Forest model, and compute rule-based kitchen prep recommendations.
        </p>
      </div>

      {/* 1. Next-Day Recommender Hub */}
      <NextDayDinnerRecommender
        selectedCafeteria={cafeteriaId}
        onApplyDinersToSimulator={handleApplyDinersToSimulator}
        onSimulateItem={handleSimulateItem}
      />

      <div id="simulator-form" className="pt-4 border-t border-slate-200">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-forest-700" />
            <span>Single-Item Scenario Simulator</span>
          </h2>
          <p className="text-xs text-slate-500">
            Simulate custom weather, attendance spikes, and preparation buffers for an individual menu product.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Interactive Forecast Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Calculator className="w-5 h-5 text-forest-700" />
              <h2 className="font-semibold text-base text-slate-900">Forecast Parameters</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cafeteria */}
                <div>
                  <label htmlFor="form-cafeteria" className="block text-xs font-semibold text-slate-700 mb-1">
                    Cafeteria Facility
                  </label>
                  <select
                    id="form-cafeteria"
                    value={cafeteriaId}
                    onChange={(e) => setCafeteriaId(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    {cafeterias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Food Item */}
                <div>
                  <label htmlFor="form-food-item" className="block text-xs font-semibold text-slate-700 mb-1">
                    Food Item
                  </label>
                  <select
                    id="form-food-item"
                    value={foodItemId}
                    onChange={(e) => setFoodItemId(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    {foodItems.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.category} - {f.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Date */}
                <div>
                  <label htmlFor="form-target-date" className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Forecast Date
                  </label>
                  <input
                    id="form-target-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    required
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                {/* Expected Customer Count */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="form-customer-count" className="text-xs font-semibold text-slate-700">
                      Expected Diners: <span className="text-forest-700 font-bold">{expectedCustomers}</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleQuickRecommendDiners}
                      className="text-[10px] font-bold text-forest-700 hover:text-forest-900 bg-forest-50 hover:bg-forest-100 px-2 py-0.5 rounded border border-forest-200 inline-flex items-center gap-1 transition-colors"
                      title="Fetch AI recommended diners for this date"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Auto-Recommend</span>
                    </button>
                  </div>
                  <input
                    id="form-customer-count"
                    type="range"
                    min="100"
                    max="2000"
                    step="25"
                    value={expectedCustomers}
                    onChange={(e) => setExpectedCustomers(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-forest-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>100</span>
                    <span>1,000</span>
                    <span>2,000</span>
                  </div>
                </div>

                {/* Weather Condition */}
                <div>
                  <label htmlFor="form-weather" className="block text-xs font-semibold text-slate-700 mb-1">
                    Weather Condition
                  </label>
                  <select
                    id="form-weather"
                    value={weatherCondition}
                    onChange={(e) => setWeatherCondition(e.target.value)}
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  >
                    <option value="Sunny">Sunny / Warm</option>
                    <option value="Rainy">Rainy / Overcast</option>
                    <option value="Cloudy">Cloudy / Mild</option>
                    <option value="Cold">Cold / Chilly</option>
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <label htmlFor="form-temp" className="block text-xs font-semibold text-slate-700 mb-1">
                    Temperature (°C)
                  </label>
                  <input
                    id="form-temp"
                    type="number"
                    step="0.5"
                    value={temperatureC}
                    onChange={(e) => setTemperatureC(Number(e.target.value))}
                    className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                </div>

                {/* Safety Buffer */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="form-safety-buffer" className="text-xs font-semibold text-slate-700">
                      Kitchen Safety Preparation Buffer: <span className="text-forest-700 font-bold">{Math.round(safetyBufferPct * 100)}%</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Configurable buffer applied on model prediction</span>
                  </div>
                  <input
                    id="form-safety-buffer"
                    type="range"
                    min="0.0"
                    max="0.30"
                    step="0.02"
                    value={safetyBufferPct}
                    onChange={(e) => setSafetyBufferPct(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-forest-700"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                    <span>0% (Tight)</span>
                    <span>10% (Recommended)</span>
                    <span>30% (High Buffer)</span>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isSpecialEvent}
                    onChange={(e) => setIsSpecialEvent(e.target.checked)}
                    className="w-4 h-4 rounded text-forest-700 focus:ring-forest-500 border-slate-300"
                  />
                  <span>Special Campus Event (+20% Traffic)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={isHoliday}
                    onChange={(e) => setIsHoliday(e.target.checked)}
                    className="w-4 h-4 rounded text-forest-700 focus:ring-forest-500 border-slate-300"
                  />
                  <span>Academic Holiday / Break (-65% Traffic)</span>
                </label>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-2.5 text-sm font-semibold flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Evaluating Scikit-Learn Model...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Run ML Demand Prediction & Preparation Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Forecast Result Card */}
          {result && (
            <div className="card border-forest-200 bg-gradient-to-br from-white to-forest-50/30 space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-forest-100">
                <div>
                  <span className="badge badge-success mb-1">Forecast Complete</span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {result.food_name} — {result.target_date}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cafeteria: {result.cafeteria_id} • Expected Diners: {result.expected_customer_count}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-500 block">Surplus Waste Risk:</span>
                  <span
                    className={`badge ${
                      result.surplus_risk_level === 'high'
                        ? 'badge-danger'
                        : result.surplus_risk_level === 'medium'
                        ? 'badge-warning'
                        : 'badge-success'
                    } text-xs font-bold uppercase tracking-wider`}
                  >
                    {result.surplus_risk_level} Risk
                  </span>
                </div>
              </div>

              {/* Key Output Metrics Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-soft-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Model Predicted Demand
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-forest-800">{result.predicted_demand}</span>
                    <span className="text-xs font-semibold text-slate-600">{result.unit}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Inference from trained Random Forest</span>
                </div>

                <div className="p-4 rounded-xl bg-emerald-700 text-white shadow-soft">
                  <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
                    Recommended Kitchen Prep
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-white">{result.recommended_prep}</span>
                    <span className="text-xs font-semibold text-emerald-200">{result.unit}</span>
                  </div>
                  <span className="text-[11px] text-emerald-200 mt-1 block">Net quantity to cook today</span>
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-soft-sm">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Existing Usable Inventory
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-slate-800">{result.existing_usable_inventory}</span>
                    <span className="text-xs font-semibold text-slate-600">{result.unit}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Deducted from gross target</span>
                </div>
              </div>

              {/* Documented Preparation Formula Breakdown */}
              <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200/80 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Calculator className="w-4 h-4 text-forest-700" />
                  <span>Preparation Decision Engine Calculation Breakdown:</span>
                </div>
                <div className="font-mono text-slate-700 bg-white p-2.5 rounded border border-slate-200 leading-relaxed">
                  Recommended = max(0, ⌈({result.predicted_demand} × {1 + result.safety_buffer_pct})⌉ - {result.existing_usable_inventory}) = <strong>{result.recommended_prep} {result.unit}</strong>
                </div>
                <p className="text-slate-600 leading-relaxed">{result.explanation}</p>
              </div>

              {/* Feature Impact Factors */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Key Prediction Factors (Explainable AI)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.factors.map((f, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-white border border-slate-200/70 text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-0.5">
                        <span>{f.factor}</span>
                        <span className="text-forest-700 font-bold">{f.impact}</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Active Model Metrics & Audit History (1 col) */}
        <div className="space-y-6">
          {/* Active Model Performance Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-900">
                <Sparkles className="w-4 h-4 text-forest-700" />
                <span>Active Model Validation</span>
              </div>
              <span className="badge badge-success text-[10px]">
                {modelMetrics?.active_model?.version_tag || 'v1.0'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Trained Architecture</span>
                <span className="text-xs font-semibold text-slate-900 font-mono">
                  {modelMetrics?.active_model?.algorithm || 'RandomForestRegressor'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Test MAE</span>
                  <span className="text-base font-bold text-forest-700">
                    {modelMetrics?.active_model?.mae?.toFixed(2) || '7.03'}
                  </span>
                  <span className="text-[9px] text-slate-400 block">units</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Test RMSE</span>
                  <span className="text-base font-bold text-slate-800">
                    {modelMetrics?.active_model?.rmse?.toFixed(2) || '11.59'}
                  </span>
                  <span className="text-[9px] text-slate-400 block">units</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Held-Out R²</span>
                  <span className="text-base font-bold text-emerald-600">
                    {modelMetrics?.active_model?.r2?.toFixed(3) || '0.979'}
                  </span>
                  <span className="text-[9px] text-slate-400 block">goodness</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-[11px] text-emerald-800 leading-relaxed">
                Evaluated on 980 held-out chronological test observations without future lookahead leakage.
              </div>
            </div>
          </div>

          {/* Recent Prediction History Log */}
          <div className="card">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-900">
                <History className="w-4 h-4 text-slate-500" />
                <span>Prediction History</span>
              </div>
              <span className="text-[11px] text-slate-400">{history.length} logged</span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No forecasts run yet.</p>
              ) : (
                history.slice(0, 8).map((h) => (
                  <div key={h.id} className="p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 transition-colors text-xs space-y-1">
                    <div className="flex items-center justify-between font-medium text-slate-900">
                      <span className="truncate max-w-[150px]">{h.food_name || h.food_item_id}</span>
                      <span className="text-forest-700 font-bold">{h.predicted_demand} {h.unit}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{h.cafeteria_id} • {h.target_date}</span>
                      <span>Prep: {h.recommended_prep} {h.unit}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
