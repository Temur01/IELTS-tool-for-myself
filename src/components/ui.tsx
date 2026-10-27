'use client';
// Small shared UI pieces.

import type { ReactNode } from 'react';

export const SOURCES: Record<string, string> = {
  reading: 'Reading',
  listening: 'Listening',
  general: 'General English',
};

export function SourceChip({ source }: { source: string }) {
  return <span className={`chip chip-${source}`}>{SOURCES[source] ?? source}</span>;
}

interface NoticeProps {
  kind?: 'info' | 'success' | 'warn' | 'error';
  children: ReactNode;
  onRetry?: () => void;
  onClose?: () => void;
}

export function Notice({ kind = 'info', children, onRetry, onClose }: NoticeProps) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      <span className="row">
        {onRetry && (
          <button type="button" className="btn btn-sm" onClick={onRetry}>
            Try again
          </button>
        )}
        {onClose && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Dismiss">
            ✕
          </button>
        )}
      </span>
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="row muted">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 72 : 52 }} />
      ))}
    </div>
  );
}

interface SegmentedOption<T> {
  value: T;
  label: string;
}

interface SegmentedProps<T> {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface FormatDateOptions {
  time?: boolean;
}

export function formatDate(value: string | null | undefined, { time = false }: FormatDateOptions = {}): string {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function Highlighted({ before, answer, after }: { before: string; answer: string; after: string }) {
  return (
    <>
      {before}
      <mark>{answer}</mark>
      {after}
    </>
  );
}
