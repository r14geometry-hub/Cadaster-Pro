import { Router } from "express";
import { logger } from "../lib/logger";
import { DISTRICTS_BY_REGION, CITIES_BY_REGION, CITIES_BY_DISTRICT } from "../lib/address-lookup";

const router = Router();

const DADATA_API_KEY = process.env.DADATA_API_KEY;

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

// ─── Built-in address database (all 85 Russian regions) ───────────────────────
// Used when DADATA_API_KEY is not configured — works in any environment.
// Data sourced from address-lookup.ts (also used for backend validation).

const MOCK_STREETS = [
  "ул. Ленина", "ул. Мира", "ул. Советская", "ул. Центральная", "ул. Садовая",
  "ул. Победы", "ул. Молодёжная", "ул. Школьная", "ул. Лесная", "ул. Набережная",
  "ул. Кирова", "ул. Гагарина", "ул. Пушкина", "ул. Октябрьская", "ул. Полевая",
  "пр. Ленина", "пр. Мира", "пр. Победы", "пр. Октябрьский", "пер. Садовый",
  "бул. Строителей", "наб. Реки", "ш. Московское", "ул. Строителей", "ул. Заречная",
];

function builtInSuggest(
  query: string,
  level: string,
  region?: string,
  district?: string,
): AddressSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const results: AddressSuggestion[] = [];

  if (level === "district") {
    const sources = region && DISTRICTS_BY_REGION[region]
      ? { [region]: DISTRICTS_BY_REGION[region] }
      : DISTRICTS_BY_REGION;

    for (const [reg, dists] of Object.entries(sources)) {
      for (const dist of dists) {
        if (dist.toLowerCase().includes(q)) {
          results.push({
            label: dist,
            value: dist,
            fiasId: null,
            level,
            type: "район",
            region: reg,
            district: dist,
            locality: null,
            fullAddress: `${dist} район, ${reg}`,
          });
          if (results.length >= 10) break;
        }
      }
      if (results.length >= 10) break;
    }
  } else if (level === "locality" || level === "territory") {
    if (district && CITIES_BY_DISTRICT[district]) {
      for (const city of CITIES_BY_DISTRICT[district]) {
        if (city.toLowerCase().includes(q)) {
          results.push({
            label: city,
            value: city,
            fiasId: null,
            level,
            type: "населённый пункт",
            region: region ?? null,
            district,
            locality: city,
            fullAddress: `${city}, ${district} район, ${region ?? ""}`.trim().replace(/, $/, ""),
          });
          if (results.length >= 10) break;
        }
      }
    }

    if (results.length < 10) {
      const regionCities = region && CITIES_BY_REGION[region]
        ? CITIES_BY_REGION[region]
        : Object.values(CITIES_BY_REGION).flat();

      for (const city of regionCities) {
        if (city.toLowerCase().includes(q) && !results.some(r => r.label === city)) {
          results.push({
            label: city,
            value: city,
            fiasId: null,
            level,
            type: "город",
            region: region ?? null,
            district: district ?? null,
            locality: city,
            fullAddress: city,
          });
          if (results.length >= 10) break;
        }
      }
    }
  } else if (level === "region") {
    const allRegions = Object.keys(DISTRICTS_BY_REGION);
    for (const reg of allRegions) {
      if (reg.toLowerCase().includes(q)) {
        results.push({
          label: reg,
          value: reg,
          fiasId: null,
          level,
          type: "субъект РФ",
          region: reg,
          district: null,
          locality: null,
          fullAddress: reg,
        });
        if (results.length >= 10) break;
      }
    }
  } else if (level === "street") {
    for (const street of MOCK_STREETS) {
      if (street.toLowerCase().includes(q)) {
        results.push({
          label: street,
          value: street,
          fiasId: null,
          level,
          type: "улица",
          region: region ?? null,
          district: district ?? null,
          locality: null,
          fullAddress: street,
        });
        if (results.length >= 10) break;
      }
    }
  } else {
    for (const street of MOCK_STREETS) {
      if (street.toLowerCase().includes(q)) {
        results.push({
          label: street,
          value: street,
          fiasId: null,
          level,
          type: "улица",
          region: region ?? null,
          district: district ?? null,
          locality: null,
          fullAddress: street,
        });
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

  if (!DADATA_API_KEY) {
    res.json(builtInSuggest(query.trim(), level, region, district));
    return;
  }

  try {
    const results = await dadataSuggest(query.trim(), level, region, district, parentId);
    res.json(results);
  } catch (err) {
    logger.error({ err }, "Dadata suggest error — falling back to built-in database");
    res.json(builtInSuggest(query.trim(), level, region, district));
  }
});

export default router;
