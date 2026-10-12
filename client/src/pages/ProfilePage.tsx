import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Mail,
  Save,
  UserRound,
  Briefcase,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { fetchDatasetStatus } from '../api/client';
import type { DatasetStatus } from '../types/analytics';
import { ACCENTS, getInitials, saveProfile, useProfile, type AccentKey, type UserProfile } from '../lib/profile';

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

  useEffect(() => {
    setForm(stored);
  }, [stored]);

  const emailError = form.email.trim() && !EMAIL_PATTERN.test(form.email.trim()) ? 'Enter a valid email address' : undefined;
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);

  const update = (key: keyof UserProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailError) return;
    const next: UserProfile = {
      accent: form.accent,
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

  return (
    <div className="space-y-6">
      {/* Identity banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-800 to-indigo-600 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {stored.avatarUrl ? (
            <img
              src={stored.avatarUrl}
              alt={stored.name}
              className="h-20 w-20 shrink-0 rounded-2xl border border-white/30 object-cover shadow-xl shadow-indigo-950/40"
            />
          ) : (
            <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-gradient-to-br ${ACCENTS[stored.accent]} text-2xl font-extrabold text-indigo-950! shadow-xl shadow-indigo-950/40`}>
              {getInitials(stored.name)}
            </span>
          )}
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{stored.name}</h1>
              {stored.isGoogleAuth && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Google Verified
                </span>
              )}
            </div>
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
            <CardDescription>Stored in this browser only.</CardDescription>
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
                  readOnly
                  helperText="Set by your sign-in account"
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

              <fieldset>
                <legend className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-700">Avatar colour</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACCENTS) as AccentKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={`${key} avatar`}
                      aria-pressed={form.accent === key}
                      onClick={() => {
                        setSaved(false);
                        setForm((prev) => ({ ...prev, accent: key }));
                      }}
                      className={`h-9 w-9 rounded-full bg-gradient-to-br ${ACCENTS[key]} ring-offset-2 ring-offset-transparent transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                        form.accent === key ? 'scale-110 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span />
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

        {/* Workspace snapshot & integrations */}
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

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
