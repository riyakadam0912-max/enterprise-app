'use client';

/**
 * SearchableSelect
 * A lightweight combobox that renders a floating list of options filtered by
 * a text input.  No external deps — just React + Tailwind.
 *
 * Props:
 *   options   – { value: string; label: string }[]
 *   value     – currently selected value (the code/id, not the label)
 *   onChange  – callback receiving the new value string
 *   placeholder – input placeholder
 *   disabled  – disables the control
 *   className – extra classes on the root wrapper
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** If true, show a "clear" button when a value is selected */
  clearable?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  className,
  clearable = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setFocusedIndex(-1);
    }
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setFocusedIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const opt = filtered[focusedIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        setQuery('');
        setFocusedIndex(-1);
      }
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  function selectOption(opt: SelectOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
    setFocusedIndex(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setQuery('');
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition',
          'focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10',
          'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
          open && 'border-slate-400 ring-2 ring-slate-900/10',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('truncate', !selectedLabel && 'text-slate-400')}>
          {selectedLabel || placeholder}
        </span>
        <span className="ml-1 flex shrink-0 items-center gap-0.5">
          {clearable && value ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="rounded p-0.5 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-slate-400 transition-transform',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open ? (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
          {/* Search input */}
          <div className="border-b border-slate-100 px-2 py-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusedIndex(-1);
              }}
              placeholder="Type to search…"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300"
            />
          </div>

          {/* Options list */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-52 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((opt, idx) => (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => selectOption(opt)}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm transition-colors',
                    opt.value === value
                      ? 'bg-orange-50 font-medium text-orange-700'
                      : 'text-slate-800 hover:bg-slate-50',
                    focusedIndex === idx && 'bg-slate-100',
                  )}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
