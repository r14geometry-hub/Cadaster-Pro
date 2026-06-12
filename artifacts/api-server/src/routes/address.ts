import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const DADATA_API_KEY = process.env.DADATA_API_KEY;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ─── Shared return type ────────────────────────────────────────────────────────

interface AddressSuggestion {
  label: string;
  value: string;
  fiasId: string | null;
  level: string;
  type: string | null;
  region: string | null;
  district: string | null;
  locality: string | null;
  fullAddress: string;
}

// ─── Dadata provider ──────────────────────────────────────────────────────────

interface DadataData {
  fias_id?: string | null;
  region_type_full?: string | null;
  region_with_type?: string | null;
  region?: string | null;
  area_type_full?: string | null;
  area_with_type?: string | null;
  area?: string | null;
  city_type_full?: string | null;
  city_with_type?: string | null;
  city?: string | null;
  settlement_type_full?: string | null;
  settlement_with_type?: string | null;
  settlement?: string | null;
  street_type_full?: string | null;
  street_with_type?: string | null;
  street?: string | null;
  house?: string | null;
  block?: string | null;
  flat?: string | null;
}

interface DadataRaw {
  value: string;
  unrestricted_value?: string;
  data: DadataData;
}

function levelToBounds(level: string): { from: string; to: string } {
  switch (level) {
    case "region":    return { from: "region",     to: "region" };
    case "district":  return { from: "area",        to: "area" };
    case "locality":  return { from: "city",        to: "settlement" };
    case "territory": return { from: "city",        to: "settlement" };
    case "street":    return { from: "street",      to: "street" };
    case "house":     return { from: "house",       to: "house" };
    default:          return { from: "street",      to: "house" };
  }
}

function mapDadataSuggestion(s: DadataRaw, level: string): AddressSuggestion {
  const d = s.data;

  // Derive the short label based on level
  let label = s.value;
  let type: string | null = null;

  if (level === "region") {
    label = d.region_with_type ?? d.region ?? s.value;
    type = d.region_type_full ?? null;
  } else if (level === "district") {
    label = d.area_with_type ?? d.area ?? s.value;
    type = d.area_type_full ?? null;
  } else if (level === "locality" || level === "territory") {
    label = d.city_with_type ?? d.city ?? d.settlement_with_type ?? d.settlement ?? s.value;
    type = d.city_type_full ?? d.settlement_type_full ?? null;
  } else if (level === "street") {
    label = d.street_with_type ?? d.street ?? s.value;
    type = d.street_type_full ?? null;
  } else {
    label = s.value;
  }

  const locality = d.city ?? d.settlement ?? null;
  const fullAddress = s.unrestricted_value ?? s.value;

  return {
    label,
    value: label,
    fiasId: d.fias_id ?? null,
    level,
    type,
    region: d.region ?? null,
    district: d.area ?? null,
    locality,
    fullAddress,
  };
}

async function dadataSuggest(
  query: string,
  level: string,
  region?: string,
  district?: string,
  parentId?: string,
): Promise<AddressSuggestion[]> {
  const bounds = levelToBounds(level);

  const locations: Record<string, string>[] = [];
  if (region) locations.push({ region });
  if (district) {
    const loc: Record<string, string> = {};
    if (region) loc.region = region;
    loc.area = district;
    locations.push(loc);
  }

  const body: Record<string, unknown> = {
    query,
    count: 10,
    from_bound: { value: bounds.from },
    to_bound: { value: bounds.to },
  };
  if (locations.length > 0) body.locations = locations;
  if (parentId) body.locations_fias_id = [parentId];

  const resp = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Token ${DADATA_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Dadata HTTP ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json() as { suggestions: DadataRaw[] };
  return (data.suggestions ?? []).map(s => mapDadataSuggestion(s, level));
}

// ─── Mock provider (dev fallback only) ────────────────────────────────────────

const MOCK_REGIONS = [
  "Москва", "Санкт-Петербург", "Московская область", "Краснодарский край",
  "Республика Татарстан", "Свердловская область", "Новосибирская область",
  "Самарская область", "Ростовская область", "Нижегородская область",
  "Республика Башкортостан", "Челябинская область", "Иркутская область",
  "Красноярский край", "Пермский край", "Волгоградская область",
  "Тюменская область", "Саратовская область", "Воронежская область",
  "Кемеровская область", "Алтайский край", "Оренбургская область",
  "Омская область", "Хабаровский край", "Приморский край",
  "Ставропольский край", "Белгородская область", "Тульская область",
  "Ярославская область", "Томская область", "Республика Дагестан",
  "Рязанская область", "Брянская область", "Ульяновская область",
  "Удмуртская Республика", "Чувашская Республика", "Вологодская область",
  "Мурманская область", "Смоленская область", "Курская область",
  "Архангельская область", "Псковская область", "Тверская область",
  "Астраханская область", "Кировская область", "Республика Бурятия",
  "Калужская область", "Липецкая область", "Тамбовская область",
  "Пензенская область", "Орловская область", "Ивановская область",
  "Владимирская область", "Республика Коми", "Республика Мордовия",
  "Забайкальский край", "Республика Карелия", "Амурская область",
  "Костромская область", "Новгородская область", "Калининградская область",
  "Республика Саха (Якутия)", "Сахалинская область", "Республика Марий Эл",
  "Магаданская область", "Камчатский край", "Республика Хакасия",
  "Чукотский АО", "Республика Алтай", "Республика Тыва",
  "Республика Северная Осетия - Алания", "Республика Ингушетия",
  "Кабардино-Балкарская Республика", "Карачаево-Черкесская Республика",
  "Республика Калмыкия", "Республика Адыгея", "Республика Крым",
  "Еврейская автономная область", "Ненецкий АО", "Ямало-Ненецкий АО",
  "Ханты-Мансийский АО - Югра", "Севастополь",
];

const MOCK_DISTRICTS: Record<string, string[]> = {
  "Москва": ["Центральный", "Северный", "Южный", "Западный", "Восточный", "Северо-Восточный", "Юго-Западный", "Юго-Восточный", "Северо-Западный", "Зеленоградский", "Троицкий", "Новомосковский"],
  "Московская область": ["Балашихинский", "Богородский", "Дмитровский", "Истринский", "Клинский", "Красногорский", "Ленинский", "Люберецкий", "Можайский", "Мытищинский", "Одинцовский", "Подольский", "Пушкинский", "Раменский", "Сергиево-Посадский", "Серпуховской", "Солнечногорский", "Щёлковский"],
  "Санкт-Петербург": ["Адмиралтейский", "Василеостровский", "Выборгский", "Калининский", "Кировский", "Красногвардейский", "Красносельский", "Кронштадтский", "Курортный", "Московский", "Невский", "Петроградский", "Приморский", "Пушкинский", "Фрунзенский", "Центральный"],
  "Краснодарский край": ["Абинский", "Анапский", "Белореченский", "Геленджикский", "Динской", "Ейский", "Кавказский", "Каневской", "Крымский", "Лабинский", "Мостовской", "Новокубанский", "Отрадненский", "Северский", "Сочинский", "Темрюкский", "Тимашёвский", "Тихорецкий", "Туапсинский", "Усть-Лабинский"],
  "Республика Татарстан": ["Агрызский", "Азнакаевский", "Альметьевский", "Бугульминский", "Высокогорский", "Елабужский", "Зеленодольский", "Лениногорский", "Мамадышский", "Нижнекамский", "Нурлатский", "Тукаевский", "Чистопольский"],
  "Свердловская область": ["Алапаевский", "Артёмовский", "Каменский", "Первоуральский", "Режевской", "Серовский", "Сысертский"],
};

const MOCK_LOCALITIES: Record<string, string[]> = {
  "Центральный": ["Арбат", "Хамовники", "Замоскворечье", "Тверской", "Мещанский", "Красносельский"],
  "Зеленоградский": ["Зеленоград"],
  "Троицкий": ["Троицк", "Щербинка"],
  "Одинцовский": ["Одинцово", "Голицыно", "Краснознаменск", "Звенигород", "Кубинка"],
  "Красногорский": ["Красногорск", "Нахабино", "Дедовск"],
  "Мытищинский": ["Мытищи", "Пироговский"],
  "Подольский": ["Подольск", "Климовск"],
  "Сергиево-Посадский": ["Сергиев Посад", "Хотьково"],
  "Пушкинский": ["Пушкино", "Ивантеевка", "Красноармейск"],
  "Сочинский": ["Сочи", "Адлер", "Лазаревское", "Хоста"],
  "Геленджикский": ["Геленджик", "Архипо-Осиповка"],
  "Анапский": ["Анапа", "Витязево"],
  "Нижнекамский": ["Нижнекамск"],
  "Альметьевский": ["Альметьевск"],
  "Зеленодольский": ["Зеленодольск"],
  "Первоуральский": ["Первоуральск", "Билимбай"],
  "Каменский": ["Каменск-Уральский"],
};

const MOCK_REGION_CENTRES: Record<string, string> = {
  "Москва": "Москва",
  "Санкт-Петербург": "Санкт-Петербург",
  "Московская область": "Красногорск",
  "Краснодарский край": "Краснодар",
  "Республика Татарстан": "Казань",
  "Свердловская область": "Екатеринбург",
  "Новосибирская область": "Новосибирск",
  "Самарская область": "Самара",
  "Ростовская область": "Ростов-на-Дону",
  "Нижегородская область": "Нижний Новгород",
  "Республика Башкортостан": "Уфа",
  "Челябинская область": "Челябинск",
  "Иркутская область": "Иркутск",
  "Красноярский край": "Красноярск",
  "Пермский край": "Пермь",
  "Волгоградская область": "Волгоград",
  "Тюменская область": "Тюмень",
  "Саратовская область": "Саратов",
  "Воронежская область": "Воронеж",
};

const MOCK_STREETS = [
  "ул. Ленина", "ул. Мира", "ул. Советская", "ул. Центральная", "ул. Садовая",
  "ул. Победы", "ул. Молодёжная", "ул. Школьная", "ул. Лесная", "ул. Набережная",
  "ул. Кирова", "ул. Гагарина", "ул. Пушкина", "ул. Октябрьская", "ул. Полевая",
  "пр. Ленина", "пр. Мира", "пр. Победы", "пр. Октябрьский", "пер. Садовый",
  "бул. Строителей", "наб. Реки", "ш. Московское", "ул. Строителей", "ул. Заречная",
];

function mockSuggest(
  query: string,
  level: string,
  region?: string,
  district?: string,
): AddressSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: AddressSuggestion[] = [];

  if (level === "region") {
    for (const reg of MOCK_REGIONS) {
      if (reg.toLowerCase().includes(q)) {
        results.push({ label: reg, value: reg, fiasId: null, level, type: "субъект РФ", region: reg, district: null, locality: null, fullAddress: reg });
        if (results.length >= 10) break;
      }
    }
  } else if (level === "district") {
    const sources = region && MOCK_DISTRICTS[region] ? { [region]: MOCK_DISTRICTS[region] } : MOCK_DISTRICTS;
    for (const [reg, dists] of Object.entries(sources)) {
      for (const dist of dists) {
        if (dist.toLowerCase().includes(q)) {
          results.push({ label: dist, value: dist, fiasId: null, level, type: "район", region: reg, district: dist, locality: null, fullAddress: `${dist} район, ${reg}` });
          if (results.length >= 10) break;
        }
      }
      if (results.length >= 10) break;
    }
  } else if (level === "locality" || level === "territory") {
    const filterDistricts = district ? { [district]: MOCK_LOCALITIES[district] ?? [] } : MOCK_LOCALITIES;
    for (const [dist, locs] of Object.entries(filterDistricts)) {
      for (const loc of locs) {
        if (loc.toLowerCase().includes(q)) {
          const reg = region ?? Object.entries(MOCK_DISTRICTS).find(([, ds]) => ds.includes(dist))?.[0] ?? null;
          results.push({ label: loc, value: loc, fiasId: null, level, type: "населённый пункт", region: reg, district: dist, locality: loc, fullAddress: `${loc}, ${dist} район, ${reg ?? ""}` });
          if (results.length >= 10) break;
        }
      }
      if (results.length >= 10) break;
    }
    // Regional centres
    if (results.length < 10) {
      for (const [reg, centre] of Object.entries(MOCK_REGION_CENTRES)) {
        if (centre.toLowerCase().includes(q) && !results.some(r => r.locality === centre)) {
          if (!region || region === reg) {
            results.push({ label: centre, value: centre, fiasId: null, level, type: "город", region: reg, district: null, locality: centre, fullAddress: centre });
          }
        }
        if (results.length >= 10) break;
      }
    }
  } else if (level === "street") {
    for (const street of MOCK_STREETS) {
      if (street.toLowerCase().includes(q)) {
        results.push({ label: street, value: street, fiasId: null, level, type: "улица", region: region ?? null, district: district ?? null, locality: null, fullAddress: street });
        if (results.length >= 10) break;
      }
    }
  } else {
    // address / house
    for (const street of MOCK_STREETS) {
      if (street.toLowerCase().includes(q)) {
        results.push({ label: street, value: street, fiasId: null, level, type: "улица", region: region ?? null, district: district ?? null, locality: null, fullAddress: street });
        if (results.length >= 8) break;
      }
    }
  }

  return results.slice(0, 10);
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.get("/address/suggest", async (req, res) => {
  const {
    query,
    level = "address",
    region,
    district,
    parentId,
  } = req.query as {
    query: string;
    level?: string;
    region?: string;
    district?: string;
    parentId?: string;
  };

  if (!query || query.trim().length < 2) {
    res.json([]);
    return;
  }

  // Production guard — refuse silently mocked data in prod
  if (IS_PRODUCTION && !DADATA_API_KEY) {
    res.status(503).json({
      error: "ADDRESS_SERVICE_NOT_CONFIGURED",
      message: "Адресный поиск временно недоступен. Введите название вручную.",
    });
    return;
  }

  // Development fallback without key
  if (!DADATA_API_KEY) {
    logger.warn("DADATA_API_KEY not set — using mock address data (dev only)");
    res.json(mockSuggest(query.trim(), level, region, district));
    return;
  }

  try {
    const results = await dadataSuggest(query.trim(), level, region, district, parentId);
    res.json(results);
  } catch (err) {
    logger.error({ err }, "Dadata suggest error");
    // In dev, fall back to mock. In prod, surface the error.
    if (IS_PRODUCTION) {
      res.status(502).json({ error: "DADATA_ERROR", message: "Ошибка при обращении к сервису Dadata" });
    } else {
      logger.warn("Falling back to mock data in dev");
      res.json(mockSuggest(query.trim(), level, region, district));
    }
  }
});

export default router;
