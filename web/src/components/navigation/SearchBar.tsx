import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export function SearchBar({ value, onChange, placeholder = 'Search', id = 'search', name = 'search', autoComplete = 'off', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input id={id} name={name} autoComplete={autoComplete} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9" {...props} />
    </div>
  );
}
