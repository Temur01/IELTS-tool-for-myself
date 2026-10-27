import TodayView from '@/components/TodayView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Today' };

export default function TodayPage() {
  return <TodayView />;
}
