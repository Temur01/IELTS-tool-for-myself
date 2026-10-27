import WordDetailView from '@/components/WordDetailView';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Word' };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WordPage({ params }: PageProps) {
  const { id } = await params;
  return <WordDetailView id={id} />;
}
