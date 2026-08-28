'use client';

/**
 * PhoneDialCodeInput
 * Renders a dial-code selector (flag + code) followed by a number input.
 * The combined value stored is "+<dialCode> <localNumber>", e.g. "+91 9876543210".
 *
 * Props:
 *   value     – full phone string ("+91 9876543210") or just the number
 *   onChange  – receives the merged "+dialCode localNumber" string
 *   disabled
 */

import { useMemo, useState } from 'react';
import { Country } from 'country-state-city';
import { SearchableSelect, type SelectOption } from './searchable-select';

interface PhoneDialCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Parse a stored phone string back into { dialCode, local } */
function parsePhone(raw: string): { dialCode: string; local: string } {
  // Matches "+91 9876543210" or "+1 5550001234" etc.
  const m = raw.match(/^(\+\d+)\s*(.*)$/);
  if (m) return { dialCode: m[1], local: m[2] };
  return { dialCode: '+91', local: raw };
}

/** Build a deduplicated, sorted list of dial-code options from country-state-city */
function buildDialCodeOptions(): SelectOption[] {
  const seen = new Set<string>();
  const opts: SelectOption[] = [];

  const countries = Country.getAllCountries();
  for (const c of countries) {
    const code = `+${c.phonecode.replace(/[^0-9]/g, '')}`;
    if (!code || code === '+') continue;
    const key = `${code}|${c.isoCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push({
      value: key, // "+91|IN"
      label: `${c.flag ?? ''} ${c.isoCode} (${code})`,
    });
  }

  // Sort by country ISO code alphabetically, but keep India first
  opts.sort((a, b) => {
    const aCode = a.value.split('|')[1];
    const bCode = b.value.split('|')[1];
    if (aCode === 'IN') return -1;
    if (bCode === 'IN') return 1;
    return aCode.localeCompare(bCode);
  });

  return opts;
}

const DIAL_OPTIONS = buildDialCodeOptions();

/** Extract "+dialCode" from a composite "code|ISO" option value */
function dialCodeFromOptionValue(optVal: string): string {
  return optVal.split('|')[0];
}

/** Find the option value matching a dialCode string like "+91" */
function optionValueForDialCode(dialCode: string): string {
  return DIAL_OPTIONS.find((o) => o.value.startsWith(dialCode + '|'))?.value ?? DIAL_OPTIONS[0].value;
}

export function PhoneDialCodeInput({
  value,
  onChange,
  disabled = false,
}: PhoneDialCodeInputProps) {
  const { dialCode, local } = useMemo(() => parsePhone(value ?? ''), [value]);
  const [selectedOption, setSelectedOption] = useState<string>(
    () => optionValueForDialCode(dialCode),
  );

  function handleDialChange(optVal: string) {
    setSelectedOption(optVal);
    const newDialCode = dialCodeFromOptionValue(optVal);
    onChange(`${newDialCode} ${local}`.trim());
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newLocal = e.target.value.replace(/[^0-9\s\-().]/g, '');
    const dc = dialCodeFromOptionValue(selectedOption);
    onChange(`${dc} ${newLocal}`.trim());
  }

  return (
    <div className="flex gap-2">
      {/* Dial code picker */}
      <div className="w-36 shrink-0">
        <SearchableSelect
          options={DIAL_OPTIONS}
          value={selectedOption}
          onChange={handleDialChange}
          placeholder="+91"
          disabled={disabled}
        />
      </div>
      {/* Local number */}
      <input
        type="tel"
        value={local}
        onChange={handleLocalChange}
        disabled={disabled}
        placeholder="9876543210"
        className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </div>
  );
}
