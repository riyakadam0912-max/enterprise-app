'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

type AddEntryButtonProps = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

const baseClassName = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function AddEntryButton({ label, href, onClick, disabled, className = '' }: AddEntryButtonProps) {
  const classes = `${baseClassName} ${className}`.trim();
  const content = <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />;

  if (href) {
    return <Link href={href} aria-label={label} title={label} className={classes}>{content}</Link>;
  }

  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={classes}>{content}</button>;
}
