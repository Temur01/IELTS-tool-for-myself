import WordListView from '@/components/WordListView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Words' };

export default function WordsPage() {
  return <WordListView />;
}
