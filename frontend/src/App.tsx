import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DemandForecastPage } from './pages/DemandForecastPage';
import { InventoryPage } from './pages/InventoryPage';
import { WasteAnalyticsPage } from './pages/WasteAnalyticsPage';
import { RedistributionPage } from './pages/RedistributionPage';
import { DataPipelinePage } from './pages/DataPipelinePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [selectedCafeteria, setSelectedCafeteria] = useState<string>('');

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout
              selectedCafeteria={selectedCafeteria}
              onSelectCafeteria={setSelectedCafeteria}
            />
          }
        >
          <Route index element={<DashboardPage selectedCafeteria={selectedCafeteria} />} />
          <Route path="forecast" element={<DemandForecastPage selectedCafeteria={selectedCafeteria} />} />
          <Route path="inventory" element={<InventoryPage selectedCafeteria={selectedCafeteria} />} />
          <Route path="waste" element={<WasteAnalyticsPage selectedCafeteria={selectedCafeteria} />} />
          <Route path="redistribution" element={<RedistributionPage selectedCafeteria={selectedCafeteria} />} />
          <Route path="pipeline" element={<DataPipelinePage />} />
          <Route path="reports" element={<ReportsPage selectedCafeteria={selectedCafeteria} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
