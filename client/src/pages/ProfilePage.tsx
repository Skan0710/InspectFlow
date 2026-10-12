import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Database,
  FileBarChart,
  Mail,
  Save,
  Settings,
  UserRound,
  Briefcase,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchDatasetStatus } from '../api/client';
import type { DatasetStatus } from '../types/analytics';
import { getInitials, resetProfile, saveProfile, useProfile, type UserProfile } from '../lib/profile';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DATASET_LABELS: Record<DatasetStatus['activeDatasetType'], string> = {
  empty: 'No data loaded',
  genuine: 'Imported data',
  sample: 'Demo sample data',
  mixed: 'Imported and sample data',
};

const ANALYSIS_LABELS: Record<DatasetStatus['analysisStatus'], string> = {
  not_started: 'Not started',
  running: 'Running',
  completed: 'Completed',
};

export const ProfilePage: React.FC = () => {
  const stored = useProfile();
  const [form, setForm] = useState<UserProfile>(stored);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<DatasetStatus | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDatasetStatus()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatusError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const emailError = form.email.trim() && !EMAIL_PATTERN.test(form.email.trim()) ? 'Enter a valid email address' : undefined;
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);

  const update = (key: keyof UserProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    const next = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role.trim(),
      organization: form.organization.trim(),
      bio: form.bio.trim(),
    };
    saveProfile(next);
    setForm({ ...next, name: next.name || stored.name });
    setSaved(true);
  };

  const handleReset = () => {
    resetProfile();
    setForm({ name: 'Guest User', email: '', role: 'Workspace member', organization: '', bio: '' });
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Identity banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-indigo-600 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br from-indigo-200 to-violet-400 text-2xl font-extrabold text-indigo-950 shadow-xl shadow-indigo-950/40">
            {getInitials(stored.name)}
          </span>
          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{stored.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-indigo-100">
              {stored.role && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-4 w-4 text-indigo-300" />
                  {stored.role}
                </span>
              )}
              {stored.organization && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-indigo-300" />
                  {stored.organization}
                </span>
              )}
              {stored.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-indigo-300" />
                  {stored.email}
                </span>
              )}
            </div>
            {stored.bio && <p className="max-w-2xl pt-1 text-sm text-indigo-100/90">{stored.bio}</p>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile details</CardTitle>
            <CardDescription>
              Saved in this browser only. InsightFlow has no account system yet, so this is not shared with other
              devices or teammates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Display name"
                  value={form.name}
                  onChange={update('name')}
                  maxLength={60}
                  leftIcon={<UserRound className="h-4 w-4" />}
                  placeholder="Your name"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  error={emailError}
                  maxLength={120}
                  leftIcon={<Mail className="h-4 w-4" />}
                  placeholder="you@company.com"
                />
                <Input
                  label="Role"
                  value={form.role}
                  onChange={update('role')}
                  maxLength={60}
                  leftIcon={<Briefcase className="h-4 w-4" />}
                  placeholder="e.g. Product Manager"
                />
                <Input
                  label="Organization"
                  value={form.organization}
                  onChange={update('organization')}
                  maxLength={80}
                  leftIcon={<Building2 className="h-4 w-4" />}
                  placeholder="e.g. Acme Inc."
                />
              </div>
              <Textarea
                label="About"
                value={form.bio}
                onChange={update('bio')}
                maxLength={240}
                rows={3}
                placeholder="A line about what you use InsightFlow for"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} leftIcon={<RotateCcw className="h-4 w-4" />}>
                  Reset profile
                </Button>
                <div className="flex items-center gap-3">
                  {saved && !dirty && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Profile saved
                    </span>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!dirty || Boolean(emailError)}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Workspace snapshot */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workspace snapshot</CardTitle>
              <CardDescription>Live from the InsightFlow server</CardDescription>
            </CardHeader>
            <CardContent>
              {statusError ? (
                <p className="text-sm text-rose-600">Could not reach the server, so the snapshot is unavailable.</p>
              ) : !status ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Dataset</dt>
                    <dd>
                      <Badge variant="indigo" size="sm">
                        {DATASET_LABELS[status.activeDatasetType]}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Feedback records</dt>
                    <dd className="font-semibold text-slate-900">{status.totalRecords.toLocaleString()}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">AI analysis</dt>
                    <dd className="font-semibold text-slate-900">{ANALYSIS_LABELS[status.analysisStatus]}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Last import</dt>
                    <dd className="font-semibold text-slate-900">
                      {status.lastImportAt ? new Date(status.lastImportAt).toLocaleString() : 'Never'}
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shortcuts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { to: '/feedback', label: 'Feedback explorer', icon: Database },
                { to: '/reports', label: 'Executive reports', icon: FileBarChart },
                { to: '/settings', label: 'Workspace settings', icon: Settings },
              ].map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                >
                  <Icon className="h-4 w-4 text-indigo-500" />
                  {label}
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
