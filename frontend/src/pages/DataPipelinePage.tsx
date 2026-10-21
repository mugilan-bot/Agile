import React, { useState, useEffect } from 'react';
import {
  Workflow,
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Database,
  ArrowRight,
  Server,
  Cloud,
  RefreshCw,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import { PipelineExecution } from '../types';

export const DataPipelinePage: React.FC = () => {
  const [executions, setExecutions] = useState<PipelineExecution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const loadExecutions = () => {
    setLoading(true);
    api.getPipelineExecutions()
      .then(setExecutions)
      .catch((err) => console.error('Failed to load pipeline executions:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExecutions();
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadError('Only CSV files (.csv) are supported.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const res = await api.uploadCsv(file);
      setUploadResult(res);
      loadExecutions();
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Pipeline & Ingestion Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated schema validation, physical consistency auditing, duplicate prevention, and raw-to-processed pipeline staging.
          </p>
        </div>

        <a
          href={api.downloadTemplateUrl}
          download="foodflow_sample_template.csv"
          className="btn-secondary flex items-center gap-2 self-start sm:self-auto text-xs sm:text-sm"
        >
          <Download className="w-4 h-4 text-forest-700" />
          <span>Download Sample CSV Template</span>
        </a>
      </div>

      {/* Upload Zone & Result Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Dropzone (2 cols) */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <UploadCloud className="w-5 h-5 text-forest-700" />
              <span>Ingest Cafeteria Consumption CSV</span>
            </div>
            <span className="text-xs text-slate-400">Strict schema validation</span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              dragActive
                ? 'border-forest-600 bg-forest-50/50'
                : 'border-slate-200 hover:border-forest-400 bg-slate-50/50'
            }`}
          >
            <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-800">
              Drag and drop cafeteria CSV dataset here
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Supports consumption, prep records, leftovers, and weather metadata (up to 20MB)
            </p>

            <label className="btn-primary cursor-pointer inline-flex items-center gap-2 text-xs py-2 px-4">
              <UploadCloud className="w-4 h-4" />
              <span>{uploading ? 'Processing File...' : 'Select File from Device'}</span>
              <input
                type="file"
                accept=".csv"
                disabled={uploading}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>

          {uploadError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between font-bold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Pipeline Execution Succeeded ({uploadResult.execution_id})</span>
                </span>
                <span>{uploadResult.duration_ms} ms</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 text-slate-700">
                <div>Total Records: <strong>{uploadResult.total_records}</strong></div>
                <div>Valid Inserted: <strong>{uploadResult.valid_records}</strong></div>
                <div>Rejected: <strong>{uploadResult.rejected_records}</strong></div>
              </div>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="text-[11px] text-amber-800 pt-1 border-t border-emerald-200/60">
                  <span className="font-semibold">Notices: </span>
                  {uploadResult.errors.join('; ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Architecture Visualizer (1 col) */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="font-semibold text-sm text-slate-900">Pipeline Architecture</span>
            <span className="badge badge-success text-[10px]">Active</span>
          </div>

          {/* Local Mode Pipeline */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Server className="w-4 h-4 text-forest-700" />
              <span>Local Pipeline (Current Execution)</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>CSV / Admin Ingestion Endpoint</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Raw Staging (<code>data/raw_uploads/</code>)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Schema & Consistency Auditor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">4</span>
                <span>Transformed Output (<code>data/processed/</code>)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-forest-200 text-forest-800 flex items-center justify-center text-[10px] font-bold">5</span>
                <span>SQLite DB & Analytics Engine</span>
              </div>
            </div>
          </div>

          {/* Azure Cloud Mode Pipeline */}
          <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200/80 text-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-sky-950">
              <Cloud className="w-4 h-4 text-sky-700" />
              <span>Azure Cloud Mode (Target Topology)</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Azure Blob Storage ➔ Event Grid Event ➔ Serverless Azure Function ➔ Validation ➔ Azure SQL Database.
            </p>
          </div>
        </div>
      </div>

      {/* Execution History Log Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-base text-slate-900">Pipeline Execution Runs</h2>
            <p className="text-xs text-slate-500">Chronological audit log of all raw files processed</p>
          </div>
          <button
            onClick={loadExecutions}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Refresh Runs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Execution ID</th>
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Source Channel</th>
                <th className="py-2.5 px-3 text-right">Total Rows</th>
                <th className="py-2.5 px-3 text-right">Valid Rows</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Executed At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {executions.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                    {e.execution_id}
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 truncate max-w-[180px]">
                    {e.filename}
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {e.source}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-700">
                    {e.total_records.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                    {e.valid_records.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500">
                    {e.duration_ms} ms
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`badge ${
                        e.status === 'completed'
                          ? 'badge-success'
                          : e.status === 'failed'
                          ? 'badge-danger'
                          : 'badge-info'
                      } uppercase tracking-wider text-[9px]`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {e.executed_at ? new Date(e.executed_at).toLocaleString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
