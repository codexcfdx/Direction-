import React, { useState, useEffect } from 'react';
import { Search, MapPin, LocateFixed, X } from 'lucide-react';
import { geocode, Location } from '../services/routing';

interface LocationSearchProps {
  label?: string;
  placeholder: string;
  onSelect: (location: Location | null) => void;
  icon?: React.ReactNode;
  value?: string;
  onCurrentLocation?: () => void;
  isLocating?: boolean;
  className?: string;
}

export function LocationSearch({ label, placeholder, onSelect, icon, value, onCurrentLocation, isLocating, className = "" }: LocationSearchProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 2 && showDropdown) {
        setIsSearching(true);
        const res = await geocode(query);
        setResults(res);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query, showDropdown]);

  const handleSelect = (loc: Location) => {
    setQuery(loc.display_name); // Show full name
    setShowDropdown(false);
    onSelect(loc);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowDropdown(true);
    if (e.target.value === '') {
      onSelect(null);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {(label || onCurrentLocation) && (
        <div className="flex justify-between items-end mb-1">
          {label ? (
            <label className="block text-sm font-medium text-slate-700">
              {label}
            </label>
          ) : <div />}
          {onCurrentLocation && (
          <button
            type="button"
            onClick={onCurrentLocation}
            disabled={isLocating}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLocating ? (
              <div className="animate-spin h-3 w-3 border-b-2 border-indigo-600 rounded-full mr-1"></div>
            ) : (
              <LocateFixed className="h-3 w-3 mr-1" />
            )}
            Use current location
          </button>
        )}
      </div>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          {icon || <MapPin className="h-5 w-5" />}
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              e.preventDefault();
              handleSelect(results[0]);
            }
          }}
        />
        {isSearching ? (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500"></div>
          </div>
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowDropdown(false);
              onSelect(null);
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showDropdown && results.length > 0 && (
        <ul 
          className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.map((loc, idx) => (
            <li
              key={idx}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50 text-slate-900"
              onClick={() => handleSelect(loc)}
            >
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-slate-400 mr-2 flex-shrink-0" />
                <span className="block truncate">{loc.display_name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
