import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';

/** Private routes: guests are sent to the landing page, which opens the sign-in dialog. */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const { pathname } = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-indigo-100" role="status" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (status === 'guest') return <Navigate to="/" replace state={{ from: pathname }} />;
  return <>{children}</>;
};
