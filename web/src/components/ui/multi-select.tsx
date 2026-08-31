'use client';

/**
 * MultiSelect
 * A multi-select component that renders selected items as removable chips/tags
 * and provides a filterable dropdown for selecting additional options.
 * No external deps — just React + Tailwind + lucide-react.
 *
 * Props:
 *   options     – { value: string | number; label: string }[]
 *   values      – currently selected values (array of codes/ids)
 *   onChange    – callback receiving array of new values
 *   placeholder – input placeholder
 *   disabled    – disables the control
 *   className   – extra classes on the root wrapper
 *   maxSelections – optional limit on number of selections
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MultiSelectOption {
  value: string | number;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  values: (string | number)[];
  onChange: (values: (string | number)[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxSelections?: number;
}

export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = 'Search and select…',
  disabled = false,
  className,
  maxSelections,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const selectedLabels = useMemo(
    () => values.map((v) => options.find((o) => o.value === v)?.label ?? String(v)),
    [options, values],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const already = new Set(values);
    const available = options.filter((o) => !already.has(o.value));
    if (!q) return available;
    return available.filter(
      (o) => o.label.toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q),
    );
  }, [options, query, values]);

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
        if (!disabled && (!maxSelections || values.length < maxSelections)) {
          setOpen(true);
        }
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
      setFocusedIndex((i) => (i + 1 < filtered.length ? i + 1 : i));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filtered.length) {
        handleSelect(filtered[focusedIndex].value);
      }
    }
  }

  function handleSelect(value: string | number) {
    if (!disabled && (!maxSelections || values.length < maxSelections)) {
      onChange([...values, value]);
      setQuery('');
      setFocusedIndex(-1);
      inputRef.current?.focus();
    }
  }

  function handleRemove(value: string | number) {
    if (!disabled) {
      onChange(values.filter((v) => v !== value));
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setFocusedIndex(-1);
  }

  const canAddMore = !maxSelections || values.length < maxSelections;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="flex flex-wrap gap-2 p-2 min-h-11 bg-white border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-transparent transition">
        {/* Selected chips */}
        {selectedLabels.map((label, idx) => (
          <div
            key={values[idx]}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-900 text-sm rounded-full"
          >
            <span>{label}</span>
            <button
              type="button"
              onClick={() => handleRemove(values[idx])}
              disabled={disabled}
              className="text-orange-700 hover:text-orange-900 disabled:opacity-50"
              aria-label={`Remove ${label}`}
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {/* Input field */}
        {canAddMore && (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => !disabled && setOpen(true)}
            placeholder={selectedLabels.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-30 outline-none bg-transparent text-slate-900 placeholder-slate-400 text-sm py-1"
          />
        )}

        {/* Chevron icon */}
        <div className="ml-auto flex items-center">
          <ChevronDown
            size={16}
            className={cn(
              'text-slate-400 pointer-events-none transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </div>

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 text-center">
              {query ? 'No matching options' : 'All options selected'}
            </li>
          ) : (
            filtered.map((option, idx) => (
              <li
                key={option.value}
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'px-4 py-2.5 cursor-pointer text-sm transition-colors',
                  idx === focusedIndex
                    ? 'bg-orange-50 text-orange-900'
                    : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
