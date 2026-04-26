"use client";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-[--border] p-16 text-center" role="region" aria-label="Empty state">
      {/* Inline SVG illustration: empty box with a plus */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mx-auto mb-6 text-[--text-muted]"
        aria-hidden="true"
        focusable="false"
      >
        {/* Folder/box shape */}
        <rect x="20" y="35" width="80" height="65" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M20 50 L60 60 L100 50" stroke="currentColor" strokeWidth="2" fill="none" />
        {/* Plus sign */}
        <circle cx="60" cy="70" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="60" y1="62" x2="60" y2="78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="52" y1="70" x2="68" y2="70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Small decorative dots */}
        <circle cx="35" cy="80" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="85" cy="80" r="2" fill="currentColor" opacity="0.3" />
        <circle cx="60" cy="88" r="2" fill="currentColor" opacity="0.3" />
      </svg>

      <p className="font-display text-xl text-[--text-muted] mb-2">{title}</p>
      <p className="text-sm text-[--text-muted] mb-6">{description}</p>

      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[--accent] text-white rounded-lg font-medium text-sm hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] focus-visible:ring-offset-2"
        aria-label={actionLabel}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
          <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {actionLabel}
      </button>
    </div>
  );
}
