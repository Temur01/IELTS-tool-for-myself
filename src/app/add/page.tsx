import AddWordView from '@/components/AddWordView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Add word' };

export default function AddPage() {
  return <AddWordView />;
}
