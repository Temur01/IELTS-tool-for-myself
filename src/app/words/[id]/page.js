import WordDetailView from '@/components/WordDetailView';

export const metadata = { title: 'Word' };

export default async function WordPage({ params }) {
  const { id } = await params;
  return <WordDetailView id={id} />;
}
