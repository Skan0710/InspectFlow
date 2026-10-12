import type React from 'react';
import {
  LayoutDashboard,
  MessageSquareQuote,
  Sparkles,
  CheckSquare,
  FileBarChart,
  BrainCircuit,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const navigationItems: NavItem[] = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Feedback', path: '/feedback', icon: MessageSquareQuote },
  { label: 'AI Insights', path: '/insights', icon: Sparkles },
  { label: 'Actions', path: '/actions', icon: CheckSquare },
  { label: 'Reports', path: '/reports', icon: FileBarChart },
  { label: 'Adaption', path: '/adaption', icon: BrainCircuit },
];
