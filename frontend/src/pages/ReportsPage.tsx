import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Building2,
  Table,
  CheckCircle2,
  Sparkles,
  TrendingDown,
  Layers,
  HelpCircle
} from 'lucide-react';
import { api, API_BASE } from '../services/api';
import { Cafeteria } from '../types';

interface ReportsPageProps {
  selectedCafeteria: string;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ selectedCafeteria }) => {
  const [reportType, setReportType] = useState<string>('demand');
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.getCafeterias().then(setCafeterias).catch(console.error);
  }, []);

  const loadPreview = () => {
    setLoading(true);
    const url = `${API_BASE}/reports/export?report_type=${reportType}&format_type=json${
      selectedCafeteria ? `&cafeteria_id=${selectedCafeteria}` : ''
    }`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setPreviewData(Array.isArray(data) ? data.slice(0, 50) : []);
      })
      .catch((err) => console.error('Failed to load report preview:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPreview();
  }, [reportType, selectedCafeteria]);

  const handlePrint = () => {
    window.print();
  };

  const headers = previewData.length > 0 ? Object.keys(previewData[0]) : [];

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Reports & Data Export</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate and export compliance reports for demand forecasts, food waste audits, redistribution logs, and ML evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Report</span>
          </button>

          <a
            href={api.getExportUrl(reportType, 'csv', selectedCafeteria)}
            download={`foodflow_${reportType}_report.csv`}
            className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'demand', label: 'Daily Demand Forecast', desc: 'Predictive forecasts & diner counts' },
          { id: 'waste', label: 'Food Waste Audit', desc: 'Ingredient losses & root causes' },
          { id: 'inventory', label: 'Kitchen Inventory', desc: 'Active batches & leftovers' },
          { id: 'redistribution', label: 'Surplus Redistribution', desc: 'Donations & recipient logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id)}
            className={`card p-4 text-left transition-all cursor-pointer ${
              reportType === tab.id
                ? 'ring-2 ring-forest-600 border-forest-600 bg-forest-50/20 shadow-soft-sm'
                : 'hover:border-slate-300'
            }`}
          >
            <span className="font-bold text-sm text-slate-900 block">{tab.label}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* Report Data Preview Table */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-forest-700" />
            <h2 className="font-semibold text-sm text-slate-900 capitalize">
              {reportType} Report Preview ({previewData.length} records shown)
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            Export includes all available records up to 1,000 rows
          </span>
        </div>

        <div className="overflow-x-auto max-h-[550px]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={headers.length || 5} className="py-12 text-center text-slate-400 font-sans">
                    Generating report preview...
                  </td>
                </tr>
              ) : previewData.length === 0 ? (
                <tr>
                  <td colSpan={headers.length || 5} className="py-12 text-center text-slate-400 font-sans">
                    No data available for this report filter.
                  </td>
                </tr>
              ) : (
                previewData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {headers.map((h) => (
                      <td key={h} className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                        {typeof row[h] === 'boolean'
                          ? row[h] ? 'Yes' : 'No'
                          : row[h] !== null && row[h] !== undefined
                          ? String(row[h])
                          : '-'}
                      </td>
                    ))}
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
