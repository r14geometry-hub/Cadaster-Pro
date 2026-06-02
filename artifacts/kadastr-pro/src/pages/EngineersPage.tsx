import { useState } from "react";
import { useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import EngineerCard from "@/components/EngineerCard";
import { useListEngineers, getListEngineersQueryKey } from "@workspace/api-client-react";
import { Search, Users, Filter, X, ShieldCheck } from "lucide-react";

const REGIONS = [
  "Москва", "Санкт-Петербург", "Московская область", "Краснодарский край",
  "Татарстан", "Свердловская область", "Новосибирская область", "Нижегородская область",
  "Самарская область", "Ростовская область", "Другой"
];
const SPECIALIZATIONS = [
  "Межевание", "Техплан", "Кадастровый паспорт", "Постановка на учёт",
  "Снятие с учёта", "Оценка", "Обследование", "Перераспределение"
];
const RATINGS = [
  { label: "Любой рейтинг", value: "" },
  { label: "★★★★★ от 4.8", value: "4.8" },
  { label: "★★★★  от 4.5", value: "4.5" },
  { label: "★★★★  от 4.0", value: "4.0" },
  { label: "★★★   от 3.5", value: "3.5" },
];

export default function EngineersPage() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [region, setRegion] = useState(params.get("region") ?? "all");
  const [specialization, setSpecialization] = useState(params.get("specialization") ?? "all");
  const [minRating, setMinRating] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const { data, isLoading } = useListEngineers(
    {
      search: search || undefined,
      region: region !== "all" ? region : undefined,
      specialization: specialization !== "all" ? specialization : undefined,
      minRating: minRating ? parseFloat(minRating) : undefined,
      limit: 24,
    },
    { query: { queryKey: getListEngineersQueryKey({ search, region, specialization, minRating: minRating ? parseFloat(minRating) : undefined }) } }
  );

  const hasFilters = region !== "all" || specialization !== "all" || minRating !== "" || verifiedOnly || search;

  const clearFilters = () => {
    setRegion("all");
    setSpecialization("all");
    setMinRating("");
    setVerifiedOnly(false);
    setSearch("");
  };

  let items = data?.items ?? [];
  if (verifiedOnly) items = items.filter(e => e.isVerified);

  return (
    <div>
      {/* Page header */}
      <div className="bg-gradient-to-r from-gray-50 to-white border-b">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-1" data-testid="heading-engineers">
            Кадастровые инженеры
          </h1>
          <p className="text-muted-foreground">
            {data ? `${data.total} специалистов по всей России` : "Сертифицированные специалисты по всей России"}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filters */}
          <aside className="w-full lg:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border p-5 space-y-5 sticky top-20">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Фильтры
                </h3>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3 h-3" /> Сбросить
                  </button>
                )}
              </div>

              {/* Search */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Поиск</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Имя или специализация..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 text-sm"
                    data-testid="input-search-engineers"
                  />
                </div>
              </div>

              {/* Region */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Регион</label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="text-sm" data-testid="select-region">
                    <SelectValue placeholder="Все регионы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все регионы</SelectItem>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialization */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Специализация</label>
                <Select value={specialization} onValueChange={setSpecialization}>
                  <SelectTrigger className="text-sm" data-testid="select-specialization">
                    <SelectValue placeholder="Все специализации" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все специализации</SelectItem>
                    {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Rating */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Минимальный рейтинг</label>
                <Select value={minRating || "any"} onValueChange={(v) => setMinRating(v === "any" ? "" : v)}>
                  <SelectTrigger className="text-sm" data-testid="select-rating">
                    <SelectValue placeholder="Любой рейтинг" />
                  </SelectTrigger>
                  <SelectContent>
                    {RATINGS.map(r => <SelectItem key={r.value || "any"} value={r.value || "any"}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Verified toggle */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-2">Верификация</label>
                <button
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className={`w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors ${
                    verifiedOnly
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-medium"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                  data-testid="toggle-verified"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Проверены Росреестром
                </button>
              </div>
            </div>
          </aside>

          {/* Results */}
          <main className="flex-1 min-w-0">
            {/* Active filters row */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {region !== "all" && <Badge variant="secondary" className="gap-1">{region} <X className="w-3 h-3 cursor-pointer" onClick={() => setRegion("all")} /></Badge>}
                {specialization !== "all" && <Badge variant="secondary" className="gap-1">{specialization} <X className="w-3 h-3 cursor-pointer" onClick={() => setSpecialization("all")} /></Badge>}
                {minRating && <Badge variant="secondary" className="gap-1">Рейтинг от {minRating} <X className="w-3 h-3 cursor-pointer" onClick={() => setMinRating("")} /></Badge>}
                {verifiedOnly && <Badge variant="secondary" className="gap-1 text-emerald-700 bg-emerald-50 border-emerald-200"><ShieldCheck className="w-3 h-3" />Проверены <X className="w-3 h-3 cursor-pointer" onClick={() => setVerifiedOnly(false)} /></Badge>}
              </div>
            )}

            {isLoading ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-white p-5 space-y-3">
                    <div className="flex gap-3">
                      <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                    <Skeleton className="h-px w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <div className="flex gap-2">
                      <Skeleton className="h-8 flex-1 rounded-md" />
                      <Skeleton className="h-8 flex-1 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-total-engineers">
                  Найдено: <span className="font-medium text-foreground">{items.length}</span> инженеров
                </p>
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map((eng) => <EngineerCard key={eng.id} engineer={eng} />)}
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="font-semibold text-lg text-foreground mb-1">Инженеры не найдены</h3>
                <p className="text-sm mb-4">Попробуйте изменить параметры поиска</p>
                <Button variant="outline" onClick={clearFilters}>Сбросить фильтры</Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
