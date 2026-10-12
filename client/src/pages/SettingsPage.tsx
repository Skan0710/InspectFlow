import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ShieldCheck, Upload, UserRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/profile';

export const SettingsPage: React.FC = () => {
  const { user, configured, signOut } = useAuth();
  const profile = useProfile();
  const provider = user?.app_metadata?.provider === 'google' ? 'Google' : 'Email and password';

  return (
    <div className="space-y-6">
      <div className="page-header pb-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Settings</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 text-indigo-500" />
              Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="space-y-3 text-base">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Name</dt>
                <dd className="truncate font-medium text-slate-900">{profile.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Email</dt>
                <dd className="truncate font-medium text-slate-900">{user?.email ?? profile.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Sign-in method</dt>
                <dd className="font-medium text-slate-900">{provider}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-3">
              <Link to="/profile">
                <Button variant="outline">Edit profile</Button>
              </Link>
              <Button variant="ghost" leftIcon={<LogOut className="h-4 w-4" />} onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-indigo-500" />
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 text-base">
              <span className="text-slate-500">Supabase Auth</span>
              <Badge variant={configured ? 'success' : 'warning'} dot>
                {configured ? 'Configured' : 'Not configured'}
              </Badge>
            </div>
            <p className="text-base text-slate-500">
              Google sign-in also needs the Google provider enabled in the Supabase dashboard, with this app’s
              origin added as an allowed redirect URL.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-indigo-100">
              <Upload className="h-5 w-5" />
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-900">Feedback data</p>
              <p className="text-base text-slate-500">Import and manage reviews from the Feedback page.</p>
            </div>
          </div>
          <Link to="/feedback">
            <Button variant="outline">Open Feedback</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};
