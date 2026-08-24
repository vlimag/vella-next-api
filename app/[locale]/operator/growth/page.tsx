import type { Metadata } from 'next';
import { GrowthDashboard } from '@/components/operator/GrowthDashboard';

export const metadata: Metadata = {
  title: 'Growth console | Vella',
  description: 'Private aggregate acquisition and subscription visibility for Vella operators.',
  robots: { index: false, follow: false, nocache: true },
};

export default function GrowthPage() {
  return <GrowthDashboard />;
}
