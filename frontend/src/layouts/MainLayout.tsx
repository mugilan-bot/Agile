import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Trash2,
  HeartHandshake,
  Workflow,
  FileText,
  Settings as SettingsIcon,
  Leaf,
  ShieldCheck,
  Building2,
  Server,
  Bell,
  Menu,
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { Cafeteria } from '../types';

interface MainLayoutProps {
  selectedCafeteria: string;
  onSelectCafeteria: (cafeteriaId: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  selectedCafeteria,
  onSelectCafeteria,
}) => {
  const [cafeterias, setCafeterias] = useState<Cafeteria[]>([]);
  const [systemMode, setSystemMode] = useState<string>('Local Development');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    api.getCafeterias()
      .then((data) => setCafeterias(data))
      .catch((err) => console.error('Failed to load cafeterias:', err));

    api.getHealth()
      .then((h) => setSystemMode(h.mode || 'Local Development'))
      .catch(() => setSystemMode('Local Development'));
  }, []);

  const navItems = [
    { to: '/', label: 'Overview Dashboard', icon: LayoutDashboard },
    { to: '/forecast', label: 'Demand Forecast', icon: TrendingUp },
    { to: '/inventory', label: 'Food Inventory', icon: Package },
    { to: '/waste', label: 'Waste Analytics', icon: Trash2 },
    { to: '/redistribution', label: 'Redistribution', icon: HeartHandshake },
    { to: '/pipeline', label: 'Data Pipeline', icon: Workflow },
    { to: '/reports', label: 'Reports & Export', icon: FileText },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 z-30 select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/40">
          <div className="w-9 h-9 rounded-xl bg-forest-600 flex items-center justify-center text-white shadow-soft">
            <Leaf className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-white tracking-tight">FoodFlow</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-forest-900/80 text-forest-300 border border-forest-700/50">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Waste Prevention & Redistribution</p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Platform Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-forest-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ML Service Active
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">v1.0</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-400 leading-relaxed">
            <div className="flex items-center gap-1 text-slate-300 font-medium mb-1">
              <Server className="w-3.5 h-3.5 text-forest-400" />
              <span>{systemMode}</span>
            </div>
            <span>SQLite local storage. Cloud-ready for Azure Static Apps & Blob Storage.</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-soft-sm">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Cafeteria Selector */}
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-forest-700 hidden sm:block" />
              <label htmlFor="cafeteria-select" className="sr-only">Select Cafeteria</label>
              <select
                id="cafeteria-select"
                value={selectedCafeteria}
                onChange={(e) => onSelectCafeteria(e.target.value)}
                className="text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100/90 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-forest-500 cursor-pointer"
              >
                <option value="">All Cafeterias (Consolidated)</option>
                {cafeterias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Provenance Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Synthetic Baseline (5,000 Records)</span>
            </div>
          </div>

          {/* Right Header Badges */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-forest-600" />
              <span className="font-medium text-slate-700">Role: Cafeteria Manager</span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-600"></span>
              <span className="text-xs font-semibold text-slate-800 hidden xs:inline">FoodFlow Online</span>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 text-slate-300 p-4 border-b border-slate-800 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-forest-700 text-white' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
