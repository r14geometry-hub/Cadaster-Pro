import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MapPin, X, ChevronDown } from "lucide-react";

export interface RegionOption {
  id: number;
  name: string;
}

interface RegionComboboxProps {
  value: string;
  onChange: (value: string) => void;
  regions: RegionOption[];
  placeholder?: string;
  allOption?: boolean;
  allLabel?: string;
  allValue?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export default function RegionCombobox({
  value,
  onChange,
  regions,
  placeholder = "Выберите регион",
  allOption = false,
  allLabel = "Все регионы",
  allValue = "all",
  disabled = false,
  className,
  "data-testid": testId,
}: RegionComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value !== "" && value !== allValue;
  const displayLabel = value === allValue ? allLabel : value;

  const filtered = search
    ? regions.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : regions;

  function openDropdown() {
    if (disabled) return;
    setSearch("");
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function closeDropdown() {
    setIsOpen(false);
    setSearch("");
  }

  function handleSelect(name: string) {
    onChange(name);
    closeDropdown();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(allOption ? allValue : "");
    closeDropdown();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") closeDropdown();
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Closed trigger */}
      {!isOpen && (
        <button
          type="button"
          onClick={openDropdown}
          disabled={disabled}
          data-testid={testId}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors",
            disabled && "cursor-not-allowed opacity-50",
            !hasValue && "text-muted-foreground"
          )}
        >
          <span className="truncate">{hasValue ? displayLabel : (allOption ? allLabel : placeholder)}</span>
          <div className="flex shrink-0 items-center gap-1 ml-2">
            {hasValue && (
              <span
                role="button"
                aria-label="Очистить"
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                onClick={handleClear}
              >
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </button>
      )}

      {/* Open search input */}
      {isOpen && (
        <div className="relative">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск региона..."
            autoComplete="off"
            data-testid={testId ? `${testId}-search` : undefined}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm",
              "ring-offset-background placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
          />
          <button
            type="button"
            onClick={closeDropdown}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {allOption && (
            <button
              type="button"
              onMouseDown={() => handleSelect(allValue)}
              className={cn(
                "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                (value === allValue || value === "") && "bg-accent/60 font-medium"
              )}
            >
              {allLabel}
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              Ничего не найдено
            </div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={() => handleSelect(r.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                  r.name === value && "bg-accent font-medium"
                )}
              >
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
