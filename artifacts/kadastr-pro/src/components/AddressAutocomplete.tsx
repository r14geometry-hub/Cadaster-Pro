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
  onValidationChange?: (hasError: boolean) => void;
}

const NOT_FOUND_MESSAGES: Partial<Record<AddressLevel, string>> = {
  district: "Район не найден. Проверьте название или выберите другой регион.",
  locality: "Населённый пункт не найден. Проверьте название или выберите район/регион.",
  territory: "Населённый пункт не найден. Проверьте название или выберите район/регион.",
};

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
  onValidationChange,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [noResults, setNoResults] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync inputValue and reset validation state when the confirmed value changes externally
  useEffect(() => {
    setInputValue(value);
    setNoResults(false);
    setSuggestions([]);
    setIsOpen(false);
  }, [value]);

  // Reset suggestions when context (region/district) changes
  useEffect(() => {
    setSuggestions([]);
    setIsOpen(false);
    setNoResults(false);
  }, [region, district]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setIsOpen(false); setNoResults(false); return; }
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
        setNoResults(false);
        return;
      }

      if (resp.ok) {
        const data: AddressSuggestion[] = await resp.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setNoResults(data.length === 0 && q.trim().length >= 2);
      }
    } catch {
      setSuggestions([]);
      setNoResults(false);
    } finally {
      setIsLoading(false);
    }
  }, [level, region, district, parentId]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    setActiveSuggestion(-1);
    setNoResults(false);

    if (freeText) {
      onChange(v);
    } else {
      // For strict (non-freeText) fields: when the input diverges from the confirmed
      // value, clear the form field so the submission cannot contain stale data.
      if (v !== value) onChange("");
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.trim().length >= 2) {
      timerRef.current = setTimeout(() => fetchSuggestions(v), 300);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }

  function handleSelect(s: AddressSuggestion) {
    setInputValue(s.value);
    setSuggestions([]);
    setIsOpen(false);
    setNoResults(false);
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

  // Unconfirmed input: user typed something that diverges from the confirmed form value
  const hasUnconfirmedInput = !freeText && inputValue !== value && inputValue.trim().length > 0;
  // Invalid = unconfirmed AND loading has finished (we know whether suggestions exist)
  const isInvalid = hasUnconfirmedInput && !isLoading;

  // Notify parent about validation state
  useEffect(() => {
    onValidationChange?.(isInvalid);
  }, [isInvalid, onValidationChange]);

  // Show the error message only when the dropdown is closed (not while typing with open dropdown)
  const validationError = isInvalid && !isOpen
    ? (noResults
        ? (NOT_FOUND_MESSAGES[level] ?? "Значение не найдено в справочнике.")
        : "Выберите значение из списка")
    : null;

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
          className={cn(validationError && "border-destructive focus-visible:ring-destructive/30")}
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

      {validationError && (
        <div className="mt-1 flex items-start gap-1.5 text-xs text-destructive" data-testid={testId ? `${testId}-error` : undefined}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{validationError}</span>
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
