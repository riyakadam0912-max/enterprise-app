/**
 * geo-options.ts
 * Centralised helpers that build SelectOption arrays from:
 *   - country-state-city  (Country / State / City)
 *   - Intl.supportedValuesOf('timeZone')  (IANA timezones, built-in)
 *   - currency-codes  (ISO 4217)
 *
 * All helpers return { value, label } pairs where value is always the
 * machine-readable code that gets stored in the database.
 */

import { Country, State, City } from 'country-state-city';
import * as currencyCodes from 'currency-codes';
import type { SelectOption } from '@/components/ui/searchable-select';

// ─── Countries ───────────────────────────────────────────────────────────────

export function getCountryOptions(): SelectOption[] {
  return Country.getAllCountries().map((c) => ({
    value: c.isoCode,          // "IN", "US", etc.
    label: `${c.flag ?? ''} ${c.name}`.trim(),
  }));
}

// ─── States ──────────────────────────────────────────────────────────────────

export function getStateOptions(countryCode: string): SelectOption[] {
  if (!countryCode) return [];
  return State.getStatesOfCountry(countryCode).map((s) => ({
    value: s.isoCode,          // "MH", "CA", etc.
    label: s.name,
  }));
}

// ─── Cities ──────────────────────────────────────────────────────────────────

export function getCityOptions(countryCode: string, stateCode: string): SelectOption[] {
  if (!countryCode || !stateCode) return [];
  return City.getCitiesOfState(countryCode, stateCode).map((ci) => ({
    value: ci.name,            // city names are the best canonical identifier here
    label: ci.name,
  }));
}

// ─── Timezones ────────────────────────────────────────────────────────────────

let _tzCache: SelectOption[] | null = null;

export function getTimezoneOptions(): SelectOption[] {
  if (_tzCache) return _tzCache;
  // Intl.supportedValuesOf is available in Node 18+ and all modern browsers.
  const zones: string[] = (
    typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
      ? (Intl as typeof Intl & { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
      : []
  );
  _tzCache = zones.map((tz) => ({
    value: tz,
    label: tz.replace(/_/g, ' '),
  }));
  return _tzCache;
}

// ─── Currencies ───────────────────────────────────────────────────────────────

let _currencyCache: SelectOption[] | null = null;

export function getCurrencyOptions(): SelectOption[] {
  if (_currencyCache) return _currencyCache;
  _currencyCache = (currencyCodes.codes() as string[])
    .map((code) => {
      const data = currencyCodes.code(code);
      return data
        ? { value: code, label: `${code} – ${data.currency}` }
        : null;
    })
    .filter((o): o is SelectOption => o !== null)
    .sort((a, b) => {
      // INR first, then USD, then alphabetical
      if (a.value === 'INR') return -1;
      if (b.value === 'INR') return 1;
      if (a.value === 'USD') return -1;
      if (b.value === 'USD') return 1;
      return a.value.localeCompare(b.value);
    });
  return _currencyCache;
}

// ─── Country code → ISO lookup helpers ───────────────────────────────────────

/**
 * Given a stored country value ("IN" ISO code or legacy full name like "India"),
 * return the ISO code.  Falls back to "" if not found.
 */
export function resolveCountryCode(stored: string | null | undefined): string {
  if (!stored) return '';
  const all = Country.getAllCountries();
  // Try direct ISO match first
  if (all.some((c) => c.isoCode === stored)) return stored;
  // Fall back to name match (legacy data)
  return all.find((c) => c.name.toLowerCase() === stored.toLowerCase())?.isoCode ?? '';
}

/**
 * Given a stored state value ("MH" ISO code or legacy full name),
 * return the ISO code for the given country.
 */
export function resolveStateCode(countryCode: string, stored: string | null | undefined): string {
  if (!stored || !countryCode) return '';
  const states = State.getStatesOfCountry(countryCode);
  if (states.some((s) => s.isoCode === stored)) return stored;
  return states.find((s) => s.name.toLowerCase() === stored.toLowerCase())?.isoCode ?? '';
}
