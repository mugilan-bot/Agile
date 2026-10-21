import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Sparkles,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Server,
  Cloud,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Terminal,
  Cpu
} from 'lucide-react';
import { api } from '../services/api';
import { ModelMetrics } from '../types';

export const SettingsPage: React.FC = () => {
  const [settingsData, setSettingsData] = useState<Record<string, { value: string; description?: string }>>({});
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Editable settings
  const [prepBuffer, setPrepBuffer] = useState<number>(0.10);
  const [wasteThreshold, setWasteThreshold] = useState<number>(8.0);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Retraining state
  const [retrainingLoading, setRetrainingLoading] = useState<boolean>(false);
  const [retrainResult, setRetrainResult] = useState<any | null>(null);
  const [minImprovement, setMinImprovement] = useState<number>(1.0);
  const [forcePromote, setForcePromote] = useState<boolean>(false);

  // Reset demo state
  const [resetting, setResetting] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api.getSettings(),
      api.getModelMetrics(),
      api.getHealth(),
    ])
      .then(([sett, metrics, health]) => {
        setSettingsData(sett);
        setModelMetrics(metrics);
        setSystemHealth(health);

        if (sett.default_prep_buffer) {
          setPrepBuffer(parseFloat(sett.default_prep_buffer.value));
        }
        if (sett.waste_alert_threshold_pct) {
          setWasteThreshold(parseFloat(sett.waste_alert_threshold_pct.value));
        }
      })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings({
        default_prep_buffer: String(prepBuffer),
        waste_alert_threshold_pct: String(wasteThreshold),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    }
  };

  const handleRetrain = async () => {
    setRetrainingLoading(true);
    setRetrainResult(null);
    try {
      const res = await api.triggerRetraining({
        target_algorithm: 'RandomForestRegressor',
        min_improvement_pct: minImprovement,
        force_promote: forcePromote,
      });
      setRetrainResult(res);
      api.getModelMetrics().then(setModelMetrics).catch(console.error);
    } catch (err: any) {
      alert(err.message || 'Retraining failed');
    } finally {
      setRetrainingLoading(false);
    }
  };

  const handleResetDemoData = async () => {
    if (window.confirm('Are you sure you want to reset demo data? This will return demand records, inventory, and redistribution to clean baseline.')) {
      setResetting(true);
      setResetSuccess(null);
      try {
        const res = await api.resetDemoData();
        setResetSuccess(res.message);
        loadAll();
      } catch (err: any) {
        alert(err.message || 'Failed to reset demo data');
      } finally {
        setResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Configuration & ML Governance</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Tune kitchen thresholds, inspect controlled machine learning retraining safeguards, and manage environment deployment flags.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core Parameters & Cloud Status (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Thresholds Form */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-semibold text-sm text-slate-900">
              <Sliders className="w-4 h-4 text-forest-700" />
              <span>Operational Kitchen Thresholds</span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="settings-prep-buffer" className="text-xs font-semibold text-slate-700">
                    Default Preparation Safety Buffer: <span className="text-forest-700 font-bold">{Math.round(prepBuffer * 100)}%</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Current: {prepBuffer * 100}%</span>
                </div>
                <input
                  id="settings-prep-buffer"
                  type="range"
                  min="0.05"
                  max="0.25"
                  step="0.01"
                  value={prepBuffer}
                  onChange={(e) => setPrepBuffer(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-forest-700"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Safety margin added to AI demand forecasts to protect against stock-outs while minimizing over-preparation.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="settings-waste-threshold" className="text-xs font-semibold text-slate-700">
                    Waste Warning Alert Threshold: <span className="text-rose-600 font-bold">{wasteThreshold}%</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Current: {wasteThreshold}%</span>
                </div>
                <input
                  id="settings-waste-threshold"
                  type="range"
                  min="3.0"
                  max="15.0"
                  step="0.5"
                  value={wasteThreshold}
                  onChange={(e) => setWasteThreshold(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Daily waste percentage above which executive warning banners are triggered on the Overview Dashboard.
                </p>
              </div>

              {saveSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Settings saved successfully.</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Controlled Retraining Workflow Panel */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                <Cpu className="w-4 h-4 text-forest-700" />
                <span>Controlled Model Retraining Workflow</span>
              </div>
              <span className="badge badge-success text-[10px]">Safeguards Enabled</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When new actual cafeteria consumption records are uploaded, FoodFlow evaluates candidate models on chronological test periods.
              A candidate model is <strong>only promoted</strong> if its test MAE outperforms the currently active model.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <label htmlFor="settings-min-improvement" className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Required Minimum MAE Improvement (%)
                </label>
                <input
                  id="settings-min-improvement"
                  type="number"
                  step="0.5"
                  min="0.0"
                  max="10.0"
                  value={minImprovement}
                  onChange={(e) => setMinImprovement(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded p-1.5 bg-white text-xs"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={forcePromote}
                    onChange={(e) => setForcePromote(e.target.checked)}
                    className="w-4 h-4 rounded text-forest-700 focus:ring-forest-500"
                  />
                  <span>Force promote even without improvement</span>
                </label>
              </div>
            </div>

            <button
              onClick={handleRetrain}
              disabled={retrainingLoading}
              className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2"
            >
              {retrainingLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Training & Evaluating Candidate Pipeline...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Execute Controlled Retraining on Cumulative Dataset</span>
                </>
              )}
            </button>

            {retrainResult && (
              <div
                className={`p-4 rounded-xl text-xs space-y-1.5 border animate-in fade-in ${
                  retrainResult.status === 'promoted'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="uppercase tracking-wider">Status: {retrainResult.status}</span>
                  <span>Used {retrainResult.samples_used} records</span>
                </div>
                <p>{retrainResult.message}</p>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 font-mono text-[11px]">
                  <div>Candidate MAE: <strong>{retrainResult.candidate_mae}</strong></div>
                  <div>Active MAE: <strong>{retrainResult.active_mae}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Cloud Infrastructure Readiness & Reset (1 col) */}
        <div className="space-y-6">
          {/* Azure Cloud Topology */}
          <div className="card space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-900 pb-2 border-b border-slate-100">
              <Cloud className="w-4 h-4 text-sky-700" />
              <span>Azure for Students Cloud Readiness</span>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span>Frontend Host:</span>
                <span className="font-semibold text-slate-900">Azure Static Web Apps</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span>API Backend:</span>
                <span className="font-semibold text-slate-900">Azure App Service / FastApi</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span>Data Ingestion:</span>
                <span className="font-semibold text-slate-900">Azure Blob Storage</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span>Event Router:</span>
                <span className="font-semibold text-slate-900">Azure Event Grid</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span>Production DB:</span>
                <span className="font-semibold text-slate-900">Azure SQL (Free/Basic tier)</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-100 text-[11px] text-sky-800 leading-relaxed">
              Designed to run at zero-dollar cost locally with SQLite, ready for Azure subscription deployment via GitHub Actions.
            </div>
          </div>

          {/* Reset Demo Data Control */}
          <div className="card border-rose-100 space-y-3">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-rose-900 pb-2 border-b border-rose-100">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Demonstration Reset</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Need to demonstrate FoodFlow from a pristine state? Re-seed the initial 5,000 synthetic records and sample redistribution lots.
            </p>

            <button
              onClick={handleResetDemoData}
              disabled={resetting}
              className="w-full py-2 px-3 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              {resetting ? 'Resetting Baseline...' : 'Reset Demonstration Data'}
            </button>

            {resetSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                {resetSuccess}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
