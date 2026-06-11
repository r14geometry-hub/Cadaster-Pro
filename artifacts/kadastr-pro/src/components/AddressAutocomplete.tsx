import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin, AlertCircle } from "lucide-react";

export interface AddressSuggestion {
  label: string;
  value: string;
  fiasId?: string | null;
  level: string;
  type?: string | null;
  region?: string | null;
  district?: string | null;
  locality?: string | null;
  fullAddress: string;
}

export type AddressLevel = "region" | "district" | "locality" | "territory" | "street" | "house" | "address";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, suggestion?: AddressSuggestion) => void;
  level: AddressLevel;
  region?: string;
  district?: string;
  parentId?: string;
  placeholder?: string;
  disabled?: boolean;
  freeText?: boolean;
  className?: string;
  "data-testid"?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  level,
  region,
  district,
  parentId,
  placeholder,
  disabled,
  freeText = false,
  className,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Reset suggestions when context changes
  useEffect(() => {
    setSuggestions([]);
    setIsOpen(false);
  }, [region, district]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setIsOpen(false); return; }
    setIsLoading(true);
    setServiceError(null);
    try {
      const params = new URLSearchParams({ query: q, level });
      if (region) params.set("region", region);
      if (district) params.set("district", district);
      if (parentId) params.set("parentId", parentId);

      const resp = await fetch(`/api/address/suggest?${params}`);

      if (resp.status === 503) {
        const err = await resp.json() as { message?: string };
        setServiceError(err.message ?? "Адресный сервис недоступен");
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      if (resp.ok) {
        const data: AddressSuggestion[] = await resp.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [level, region, district, parentId]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    setActiveSuggestion(-1);

    if (freeText) onChange(v);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(v), 300);
  }

  function handleSelect(s: AddressSuggestion) {
    setInputValue(s.value);
    setSuggestions([]);
    setIsOpen(false);
    onChange(s.value, s);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeSuggestion >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeSuggestion]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function handleBlur() {
    setTimeout(() => setIsOpen(false), 150);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sublabel = (s: AddressSuggestion): string | null => {
    const parts: string[] = [];
    if (s.type) parts.push(s.type);
    if (level === "locality" || level === "territory") {
      if (s.district) parts.push(s.district);
      if (s.region) parts.push(s.region);
    } else if (level === "street" || level === "address") {
      if (s.locality) parts.push(s.locality);
      if (s.region) parts.push(s.region);
    } else if (level === "district") {
      if (s.region) parts.push(s.region);
    }
    return parts.length > 0 ? parts.join(", ") : null;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          data-testid={testId}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {serviceError && (
        <div className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{serviceError}</span>
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => {
            const sub = sublabel(s);
            return (
              <button
                key={s.fiasId ?? i}
                type="button"
                className={cn(
                  "w-full flex items-start gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                  i === activeSuggestion && "bg-accent"
                )}
                onMouseDown={() => handleSelect(s)}
              >
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-medium block truncate">{s.label}</span>
                  {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
