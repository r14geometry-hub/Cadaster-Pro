import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, MapPin } from "lucide-react";

interface Suggestion {
  value: string;
  district?: string | null;
  locality?: string | null;
  region?: string | null;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, suggestion?: Suggestion) => void;
  level: "district" | "locality" | "address";
  region?: string;
  placeholder?: string;
  disabled?: boolean;
  freeText?: boolean;
  "data-testid"?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  level,
  region,
  placeholder,
  disabled,
  freeText = false,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setIsOpen(false); return; }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ query: q, level });
      if (region) params.set("region", region);
      const resp = await fetch(`/api/address/suggest?${params}`);
      if (resp.ok) {
        const data: Suggestion[] = await resp.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [level, region]);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    setActiveSuggestion(-1);

    if (freeText) onChange(v);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchSuggestions(v), 300);
  }

  function handleSelect(s: Suggestion) {
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
    setTimeout(() => {
      if (!freeText && !suggestions.some(s => s.value === inputValue)) {
        // Only reset if not free text and no matching suggestion was selected
      }
      setIsOpen(false);
    }, 150);
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

  return (
    <div ref={containerRef} className="relative">
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

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className={cn(
                "w-full flex items-start gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                i === activeSuggestion && "bg-accent"
              )}
              onMouseDown={() => handleSelect(s)}
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">{s.value}</span>
                {(s.district || s.region) && level === "locality" && (
                  <p className="text-xs text-muted-foreground">
                    {[s.district, s.region].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
