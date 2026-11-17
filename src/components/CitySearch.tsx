'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { searchCities, CitySuggestion } from '@/app/trips/actions';

const DEBOUNCE_MS = 300;

export function describeCity(c: Pick<CitySuggestion, 'name' | 'admin1' | 'country'>): string {
  return [c.name, c.admin1, c.country].filter(Boolean).join(', ');
}

// "Where are you going?" — search any city in the world and pick one.
export default function CitySearch({
  onSelect,
  placeholder = 'Search for a city…',
  autoFocus = false,
}: {
  onSelect: (city: CitySuggestion) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const found = await searchCities(value);
      if (requestIdRef.current !== requestId) return;
      setResults(found);
      setSearched(true);
    }, DEBOUNCE_MS);
  };

  const select = (city: CitySuggestion) => {
    onSelect(city);
    setQuery('');
    setResults([]);
    setSearched(false);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-300 dark:placeholder-gray-600"
      />
      {open && query.trim().length >= 2 && (results.length > 0 || searched) && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-64 overflow-auto">
          {results.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-gray-400 dark:text-gray-500">No matching cities found.</li>
          ) : (
            results.map((c, i) => (
              <li key={`${c.name}-${c.lat}-${c.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => select(c)}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {c.admin1 ? `, ${c.admin1}` : ''}, {c.country}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
