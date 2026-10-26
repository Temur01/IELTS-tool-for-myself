'use client';
// Small shared UI pieces.

export const SOURCES = {
  reading: 'Reading',
  listening: 'Listening',
  general: 'General English',
};

export function SourceChip({ source }) {
  return <span className={`chip chip-${source}`}>{SOURCES[source] ?? source}</span>;
}

export function Notice({ kind = 'info', children, onRetry, onClose }) {
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

export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" className="row muted">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ lines = 3 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 72 : 52 }} />
      ))}
    </div>
  );
}

export function Segmented({ label, value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
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

export function formatDate(value, { time = false } = {}) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

/** Highlight the target term inside its context sentence. */
export function Highlighted({ before, answer, after }) {
  return (
    <>
      {before}
      <mark>{answer}</mark>
      {after}
    </>
  );
}
