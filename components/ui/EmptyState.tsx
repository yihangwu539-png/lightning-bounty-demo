"use client";

import Link from "next/link";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /**
   * Inline SVG illustration. Default is a project folder illustration.
   */
  illustration?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  illustration,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center"
      role="status"
      aria-live="polite"
    >
      <div
        className="text-[--text-muted] opacity-40"
        aria-hidden="true"
      >
        {illustration ?? (
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Empty state illustration"
          >
            {/* Folder outline */}
            <rect
              x="15"
              y="35"
              width="90"
              height="65"
              rx="6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            {/* Folder tab */}
            <path
              d="M15 41C15 37.6863 17.6863 35 21 35H45C45 35 48 35 50 40L54 48H105V53"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            {/* Document lines */}
            <line x1="35" y1="58" x2="75" y2="58" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="35" y1="66" x2="65" y2="66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="35" y1="74" x2="70" y2="74" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Plus icon */}
            <circle cx="90" cy="90" r="14" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="90" y1="84" x2="90" y2="96" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="84" y1="90" x2="96" y2="90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold text-[--text]">
          {title}
        </h3>
        <p className="text-sm text-[--text-muted] max-w-sm">
          {description}
        </p>
      </div>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link href={actionHref} passHref legacyBehavior>
            <Button variant="primary" size="lg" aria-label={actionLabel}>
              {actionLabel}
            </Button>
          </Link>
        ) : (
          <Button variant="primary" size="lg" onClick={onAction} aria-label={actionLabel}>
            {actionLabel}
          </Button>
        )
      )}
    </div>
  );
}
