import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { InsightsPage } from './pages/InsightsPage';
import { ActionCenterPage } from './pages/ActionCenterPage';
import { ReportsPage } from './pages/ReportsPage';
import { AdaptionPage } from './pages/AdaptionPage';
import { SettingsPage } from './pages/SettingsPage';
import { SmoothScrollProvider } from './components/providers/SmoothScrollProvider';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SmoothScrollProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/actions" element={<ActionCenterPage />} />
            <Route path="/adaption" element={<AdaptionPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </SmoothScrollProvider>
    </BrowserRouter>
  );
};

export default App;
