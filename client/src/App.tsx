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
import { ProfilePage } from './pages/ProfilePage';
import { GuestLanding } from './pages/GuestLanding';
import { SmoothScrollProvider } from './components/providers/SmoothScrollProvider';
import { AuthProvider, useAuth } from './lib/auth';
import { RequireAuth } from './components/auth/RequireAuth';
import { SignInModal } from './components/auth/SignInModal';

const Home: React.FC = () => {
  const { status } = useAuth();
  if (status === 'loading') return null;
  return status === 'authenticated' ? <OverviewPage /> : <GuestLanding />;
};

const priv = (page: React.ReactNode) => <RequireAuth>{page}</RequireAuth>;

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SmoothScrollProvider>
          <SignInModal />
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route path="/feedback" element={priv(<FeedbackPage />)} />
              <Route path="/insights" element={priv(<InsightsPage />)} />
              <Route path="/actions" element={priv(<ActionCenterPage />)} />
              <Route path="/adaption" element={priv(<AdaptionPage />)} />
              <Route path="/reports" element={priv(<ReportsPage />)} />
              <Route path="/settings" element={priv(<SettingsPage />)} />
              <Route path="/profile" element={priv(<ProfilePage />)} />
              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </SmoothScrollProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
