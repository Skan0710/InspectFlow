import React, { useState } from 'react';
import { 
  Save, 
  Key, 
  Sliders, 
  CheckCircle2, 
  Building2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'ai'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 700);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 page-header">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Workspace & Platform Settings
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your organization profile, data ingestion pipelines, retention limits, and AI model configurations.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" />
              Settings Saved
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isSaving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4">
        {[
          { key: 'general', label: 'General & Organization', icon: Building2 },
          { key: 'integrations', label: 'Connected Pipelines', icon: Key },
          { key: 'ai', label: 'AI Intelligence & Glossary', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'general' | 'integrations' | 'ai')}
              className={`flex items-center gap-2 border-b-2 pb-3 text-xs sm:text-sm font-semibold transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'general' && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>Configure how your tenant is identified across customer intelligence reports.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Workspace Name"
                  defaultValue="Acme Enterprise Technologies"
                  helperText="Visible in exported executive briefings."
                />
                <Input
                  label="Support Operations Email"
                  type="email"
                  defaultValue="product-ops@acme.corp"
                  helperText="Destination for urgent negative sentiment escalation alerts."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Data Retention Policy"
                  defaultValue="365"
                  helperText="Raw customer feedback records older than this will be automatically scrubbed."
                >
                  <option value="90">90 Days (Strict Compliance)</option>
                  <option value="180">180 Days</option>
                  <option value="365">1 Year (Recommended for QBR tracking)</option>
                  <option value="indefinite">Indefinite Retention</option>
                </Select>

                <Select
                  label="Default Sentiment Standard"
                  defaultValue="enterprise"
                  helperText="Standardizes threshold calibration across customer channels."
                >
                  <option value="enterprise">B2B Enterprise Standard (High Rigor)</option>
                  <option value="consumer">High Volume Consumer (Balanced)</option>
                  <option value="fintech">Regulated / Zero-Tolerance Risk</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy Defaults</CardTitle>
              <CardDescription>Govern automated PII masking and access control compliance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                    Automated PII Masking
                  </span>
                  <p className="text-xs text-slate-500">
                    Redacts customer credit cards, social security numbers, and API tokens prior to LLM embedding ingestion.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50/70 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                    Enforce SAML 2.0 Single Sign-On
                  </span>
                  <p className="text-xs text-slate-500">
                    Require all product operations team members to authenticate via enterprise identity provider.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'integrations' && (
        <Card>
          <CardHeader>
            <CardTitle>Active Data Ingestion Sources</CardTitle>
            <CardDescription>Manage bidirectional synchronization with your support and CRM toolchains.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {[
              { name: 'Zendesk Support', type: 'Tickets & Satisfaction Ratings', status: 'Connected', badge: 'success' as const, sync: '2 mins ago' },
              { name: 'Salesforce CRM', type: 'Accounts, Opportunities & Notes', status: 'Connected', badge: 'success' as const, sync: '15 mins ago' },
              { name: 'Gong Call Intelligence', type: 'Recorded Customer Transcripts', status: 'Connected', badge: 'success' as const, sync: '1 hour ago' },
              { name: 'Jira Software Cloud', type: 'Engineering Action Item Sync', status: 'Token Expired', badge: 'danger' as const, sync: 'Requires Re-auth' },
            ].map((conn, idx) => (
              <div key={idx} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{conn.name}</div>
                  <div className="text-xs text-slate-500">{conn.type}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <span className="text-[11px] text-slate-400 font-mono">Last sync: {conn.sync}</span>
                  </div>
                  <Badge variant={conn.badge} size="sm" dot>
                    {conn.status}
                  </Badge>
                  <Button variant="outline" size="sm" className="h-8">
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai' && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Product Glossary & Domain Knowledge</CardTitle>
            <CardDescription>
              Feed domain terminology and internal product codenames to prevent the clustering engine from miscategorizing key topics.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              label="Product Terminology & Acronym Dictionary"
              rows={5}
              defaultValue={`"Valkyrie": Internal codename for the high-throughput Kafka streaming pipeline
"SCIM-v2": Enterprise user auto-provisioning protocol
"GovCloud": Isolated sovereign AWS cluster for federal compliance accounts
"RBAC": Role-Based Access Control matrix`}
              helperText="The NLP semantic parser incorporates these definitions when generating topic cluster summaries."
            />

            <div className="rounded-lg bg-indigo-50/60 border border-indigo-200/80 p-3 text-xs text-indigo-900">
              <strong>Tip:</strong> Updating the domain dictionary will automatically trigger an incremental topic re-clustering on next sync.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
