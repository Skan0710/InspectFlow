import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  BrainCircuit, 
  Layers, 
  FileDown, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles,
  Database
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { BorderBeam } from '../ui/BorderBeam';
import ExpandableBentoGrid from '../ui/expandable-bento-grid';

const EXPANDABLE_BENTO_ITEMS = [
  {
    id: 'streaming-etl',
    title: 'Streaming Ingestion Pipeline',
    subtitle: 'RFC-4180 chunk streaming with hash deduplication',
    description: 'Processes 7,000+ row customer datasets with bounded memory utilization and automated deduplication.',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    content: (
      <div className="space-y-3">
        <p className="font-semibold text-slate-800">High-Throughput Ingestion Safeguards</p>
        <p>
          InsightFlow streams incoming CSV datasets in bounded 500-record chunks. Identical reviews are identified via SHA-256 hashes, tracking repeat complaint volume without corrupting raw sentiment distributions.
        </p>
        <div className="rounded-lg bg-slate-900 p-3 text-slate-200 font-mono text-xs">
          <code>
            Hash: sha256(review_text.toLowerCase())<br />
            Deduplication: True (tracks duplicate count per unique complaint)
          </code>
        </div>
      </div>
    ),
  },
  {
    id: 'grounded-ai',
    title: 'Zero-Hallucination Semantic Analysis',
    subtitle: 'Strict JSON schemas & verbatim evidence citations',
    description: 'Extracts validated sentiment, severity ratings (1-5), and primary friction topics directly grounded in customer text.',
    icon: <BrainCircuit className="h-6 w-6" />,
    content: (
      <div className="space-y-3">
        <p className="font-semibold text-slate-800">Strict Model Calibration</p>
        <p>
          Every sentiment classification and friction topic requires exact quotation excerpts from the customer review. Hallucinated topics or ungrounded statistics are rejected by runtime validation schemas.
        </p>
        <div className="rounded-lg bg-slate-900 p-3 text-slate-200 font-mono text-xs">
          <code>
            Sentiment: positive | neutral | negative | mixed<br />
            Severity: 1 (cosmetic) to 5 (blocker/data loss)
          </code>
        </div>
      </div>
    ),
  },
  {
    id: 'math-matrix',
    title: 'Deterministic Triage Scoring',
    subtitle: 'Frequency 40% + Severity 35% + Negative Ratio 25%',
    description: 'Mathematical prioritization formula ranking issues objectively with zero black-box bias.',
    icon: <Layers className="h-6 w-6" />,
    content: (
      <div className="space-y-3">
        <p className="font-semibold text-slate-800">Mathematical Priority Formula</p>
        <p>
          Issues are clustered into distinct root-cause topics and ranked through transparent equations:
        </p>
        <div className="rounded-lg bg-slate-900 p-3 text-slate-200 font-mono text-xs">
          <code>
            Priority = 100 × (0.40 × FreqScore + 0.35 × SevNorm + 0.25 × NegRatio)<br />
            Tiers: Critical (≥75) | High (≥50) | Medium (≥25) | Low (&lt;25)
          </code>
        </div>
      </div>
    ),
  },
  {
    id: 'closed-loop',
    title: 'Action Lifecycle & Collaboration',
    subtitle: 'Status workflows with assignee ownership & notes',
    description: 'Track issues across Open, In Progress, Resolved, and Dismissed states with full audit history.',
    icon: <ShieldCheck className="h-6 w-6" />,
    content: (
      <div className="space-y-3">
        <p className="font-semibold text-slate-800">Persistent Issue Tracking</p>
        <p>
          Assign issues to specific team members, attach internal investigation notes, star high-risk items, and synchronize changes with real-time dashboard metrics.
        </p>
      </div>
    ),
  },
  {
    id: 'executive-delivery',
    title: 'Executive PDF & CSV Digests',
    subtitle: 'Automated board briefings with traceable evidence',
    description: 'Generate sanitized, publication-ready PDF intelligence briefs and CSV exports in seconds.',
    icon: <FileDown className="h-6 w-6" />,
    content: (
      <div className="space-y-3">
        <p className="font-semibold text-slate-800">Board-Ready Executive Delivery</p>
        <p>
          Reports compile scope analytics, sentiment distributions, priority matrices, and verifiable feedback excerpts with page numbering and cryptographic integrity checks.
        </p>
      </div>
    ),
  },
  {
    id: 'adaption-tuning',
    title: 'Adaption Domain Tuning',
    subtitle: 'Fine-tune models on domain-specific customer terminology',
    description: 'Benchmark baseline vs adapted model classification accuracy on industry-specific feedback.',
    icon: <Sparkles className="h-6 w-6" />,
    content: (
      <div className="space-y-3">
        <p className="font-semibold text-slate-800">Adaption AI Fine-Tuning</p>
        <p>
          Connects InsightFlow to Adaption tuning pipelines to adapt LLM classification accuracy for specialized B2B fintech, logistics, and enterprise SaaS customer jargon.
        </p>
      </div>
    ),
  },
];

interface BentoFeature {
  id: string;
  badge: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  metric: string;
  metricLabel: string;
  details: string[];
}

export const WorkflowFeatureBento: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('ingest');

  const features: BentoFeature[] = [
    {
      id: 'ingest',
      badge: 'High-Throughput Ingestion',
      title: 'Streaming Multi-Source Voice Pipeline',
      description: 'Ingest raw user feedback from 7,000+ row CSV dumps or instant manual submissions. Deduplicates identical reviews and prevents formula injection.',
      icon: FileSpreadsheet,
      tag: 'ETL Pipeline',
      metric: '7,000+',
      metricLabel: 'Batch Rows Processed',
      details: [
        'Safe RFC-4180 CSV parser with streaming chunk limits',
        'Duplicate text hashing and verbatim ratio telemetry',
        'Direct provenance tagging (genuine import vs demo sample)',
      ],
    },
    {
      id: 'analysis',
      badge: 'Grounded AI Engine',
      title: 'Strictly Grounded Semantic Classification',
      description: 'Extracts validated sentiments, severity ratings (1-5), primary root causes, and verbatim quotation evidence. Rejects hallucinated data points.',
      icon: BrainCircuit,
      tag: 'AI Intelligence',
      metric: '100%',
      metricLabel: 'Evidence Grounded',
      details: [
        'Strict schema enforcement with fallback recovery',
        'Verbatim evidence phrase citations with source row IDs',
        'Confidence scoring with explicit low-confidence flags',
      ],
    },
    {
      id: 'scoring',
      badge: 'Deterministic Matrix',
      title: 'Mathematical Priority Triage',
      description: 'Multi-factor algorithm ranking issues objectively by Frequency (40%), Severity (35%), and Negative Sentiment Ratio (25%). Fully transparent and reproducible.',
      icon: Layers,
      tag: 'Triage Engine',
      metric: '0 - 100',
      metricLabel: 'Deterministic Score',
      details: [
        'No opaque hallucinations or arbitrary rankings',
        'Distinct tiers: Critical (≥75), High (≥50), Medium, Low',
        'Immediate recalculation upon new feedback analysis',
      ],
    },
    {
      id: 'actions',
      badge: 'Closed-Loop Actions',
      title: 'Executive Briefings & PDF Export',
      description: 'Assign issues to responsible teams, track resolution lifecycles, and generate professional PDF intelligence reports and CSV digests in seconds.',
      icon: FileDown,
      tag: 'Executive Delivery',
      metric: 'PDF & CSV',
      metricLabel: 'Export Ready',
      details: [
        'Action Center with Open, In Progress, and Resolved flows',
        'Traceable recommendation citations with real feedback IDs',
        'Automated executive summaries with historical integrity flags',
      ],
    },
  ];

  const currentFeature = features.find((f) => f.id === activeTab) || features[0];
  const CurrentIcon = currentFeature.icon;

  return (
    <section className="py-8 space-y-6">
      {/* Header with Mintlify-style clean typography */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/60 px-3 py-0.5 text-xs font-semibold text-indigo-700 mb-2">
            <Sparkles className="h-3 w-3 text-indigo-600" />
            21st.dev & Mintlify Architecture Design
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Engineered for Grounded Customer Intelligence
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            A production-grade feedback processing suite combining high-performance ETL, verifiable AI reasoning, and mathematical prioritization.
          </p>
        </div>

        {/* Feature Tab Selectors */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
          {features.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveTab(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === f.id
                  ? 'bg-white text-indigo-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {f.tag}
            </button>
          ))}
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Active Feature Deep-Dive Card (7 cols) with 21st.dev BorderBeam */}
        <div className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-indigo-50/20 p-6 sm:p-7 shadow-xs">
          <BorderBeam size={160} duration={10} borderWidth={1.5} colorFrom="#6366f1" colorTo="#8b5cf6" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-600 border border-indigo-200/60">
                  <CurrentIcon className="h-5 w-5" />
                </div>
                <div>
                  <Badge variant="indigo" size="sm">
                    {currentFeature.badge}
                  </Badge>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Component Key: system/{currentFeature.id}-service
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {currentFeature.metric}
                </span>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {currentFeature.metricLabel}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {currentFeature.title}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                {currentFeature.description}
              </p>
            </div>

            {/* Checkpoints list */}
            <div className="pt-2 border-t border-slate-200/80 space-y-2">
              {currentFeature.details.map((detail, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Supporting Architectural Bento Cards (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-indigo-600" />
                Deterministic Scoring Formula
              </span>
              <Badge variant="neutral" size="sm">
                Strict Math
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200/70">
              Score = (Freq × 0.40) + (SevNorm × 0.35) + (NegRatio × 0.25)
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Anti-Hallucination Guardrails
              </span>
              <Badge variant="success" size="sm">
                Verified
              </Badge>
            </div>
            <p className="text-xs text-slate-600 leading-normal">
              Every executive recommendation and ticket references validated feedback IDs and measured negative ratios from the database.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Expandable Bento Grid */}
      <div className="mt-8 pt-6 border-t border-slate-200/80">
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
            <Sparkles className="h-3 w-3 text-indigo-600" />
            Expandable Architecture Cards
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
            Deep-Dive into System Subsystems
          </h3>
          <p className="text-xs text-slate-500">
            Click any subsystem card below to expand full operational specs, formulas, and schema guarantees.
          </p>
        </div>
        <ExpandableBentoGrid items={EXPANDABLE_BENTO_ITEMS} />
      </div>
    </section>
  );
};
