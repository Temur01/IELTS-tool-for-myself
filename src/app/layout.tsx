import { Instrument_Serif, Plus_Jakarta_Sans } from 'next/font/google';
import AppShell from '@/components/AppShell';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-serif' });
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Lexi · IELTS Vocabulary', template: '%s · Lexi' },
  description: 'Capture, paraphrase and review vocabulary for IELTS Academic.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ef' },
    { media: '(prefers-color-scheme: dark)', color: '#121211' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
