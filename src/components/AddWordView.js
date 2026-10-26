'use client';
import Link from 'next/link';
import { useState } from 'react';
import WordForm, { BLANK_WORD } from './WordForm';
import { Notice } from './ui';

export default function AddWordView() {
  const [saved, setSaved] = useState(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <div className="hero">
        <span className="eyebrow">Capture</span>
        <h1>Add a word</h1>
      </div>
      {saved && (
        <div style={{ marginBottom: '1rem' }}>
          <Notice kind="success" onClose={() => setSaved(null)}>
            Saved “{saved.term}”. It&apos;s due for review now. <Link href={`/words/${saved.id}`}>View it</Link>
          </Notice>
        </div>
      )}
      <WordForm
        key={formKey}
        initial={{ ...BLANK_WORD, source: saved?.source ?? BLANK_WORD.source }}
        onSaved={(w) => {
          setSaved(w);
          setFormKey((k) => k + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </>
  );
}
