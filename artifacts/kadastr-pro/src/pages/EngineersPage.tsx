import { useState } from "react";
import { useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EngineerCard from "@/components/EngineerCard";
import { useListEngineers, getListEngineersQueryKey } from "@workspace/api-client-react";
import { Search, Users, SlidersHorizontal } from "lucide-react";

const REGIONS = ["Москва", "Санкт-Петербург", "Московская область", "Краснодарский край", "Татарстан", "Свердловская область", "Новосибирская область", "Другой"];
const SPECIALIZATIONS = ["Межевание", "Техплан", "Кадастровый паспорт", "Постановка на учёт", "Снятие с учёта", "Оценка"];
const RATINGS = [{ label: "Любой рейтинг", value: "" }, { label: "От 4.5", value: "4.5" }, { label: "От 4", value: "4" }, { label: "От 3.5", value: "3.5" }];

export default function EngineersPage() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState(params.get("region") ?? "all");
  const [specialization, setSpecialization] = useState(params.get("specialization") ?? "all");
  const [minRating, setMinRating] = useState("");

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

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-engineers">Каталог инженеров</h1>
        <p className="text-muted-foreground">Сертифицированные кадастровые инженеры России</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или специализации..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-engineers"
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-full sm:w-52" data-testid="select-region">
            <SelectValue placeholder="Регион" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все регионы</SelectItem>
            {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={specialization} onValueChange={setSpecialization}>
          <SelectTrigger className="w-full sm:w-52" data-testid="select-specialization">
            <SelectValue placeholder="Специализация" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все специализации</SelectItem>
            {SPECIALIZATIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={minRating} onValueChange={setMinRating}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-rating">
            <SelectValue placeholder="Рейтинг" />
          </SelectTrigger>
          <SelectContent>
            {RATINGS.map(r => <SelectItem key={r.value || "any"} value={r.value || "any"}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      ) : data && data.items.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-total-engineers">
            Найдено: {data.total} инженеров
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((eng) => <EngineerCard key={eng.id} engineer={eng} />)}
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <h3 className="font-medium text-foreground mb-1">Инженеры не найдены</h3>
          <p className="text-sm">Попробуйте изменить параметры поиска</p>
        </div>
      )}
    </div>
  );
}
