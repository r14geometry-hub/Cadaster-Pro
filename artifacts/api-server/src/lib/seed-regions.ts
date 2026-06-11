import { db, regionsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

export const RF_REGIONS: Array<{ code: string; name: string; federalDistrict: string }> = [
  // Центральный
  { code: "31", name: "Белгородская область", federalDistrict: "Центральный" },
  { code: "32", name: "Брянская область", federalDistrict: "Центральный" },
  { code: "33", name: "Владимирская область", federalDistrict: "Центральный" },
  { code: "36", name: "Воронежская область", federalDistrict: "Центральный" },
  { code: "37", name: "Ивановская область", federalDistrict: "Центральный" },
  { code: "40", name: "Калужская область", federalDistrict: "Центральный" },
  { code: "44", name: "Костромская область", federalDistrict: "Центральный" },
  { code: "46", name: "Курская область", federalDistrict: "Центральный" },
  { code: "48", name: "Липецкая область", federalDistrict: "Центральный" },
  { code: "50", name: "Московская область", federalDistrict: "Центральный" },
  { code: "57", name: "Орловская область", federalDistrict: "Центральный" },
  { code: "62", name: "Рязанская область", federalDistrict: "Центральный" },
  { code: "67", name: "Смоленская область", federalDistrict: "Центральный" },
  { code: "68", name: "Тамбовская область", federalDistrict: "Центральный" },
  { code: "69", name: "Тверская область", federalDistrict: "Центральный" },
  { code: "71", name: "Тульская область", federalDistrict: "Центральный" },
  { code: "76", name: "Ярославская область", federalDistrict: "Центральный" },
  { code: "77", name: "Москва", federalDistrict: "Центральный" },
  // Северо-Западный
  { code: "10", name: "Республика Карелия", federalDistrict: "Северо-Западный" },
  { code: "11", name: "Республика Коми", federalDistrict: "Северо-Западный" },
  { code: "29", name: "Архангельская область", federalDistrict: "Северо-Западный" },
  { code: "35", name: "Вологодская область", federalDistrict: "Северо-Западный" },
  { code: "39", name: "Калининградская область", federalDistrict: "Северо-Западный" },
  { code: "47", name: "Ленинградская область", federalDistrict: "Северо-Западный" },
  { code: "51", name: "Мурманская область", federalDistrict: "Северо-Западный" },
  { code: "53", name: "Новгородская область", federalDistrict: "Северо-Западный" },
  { code: "60", name: "Псковская область", federalDistrict: "Северо-Западный" },
  { code: "78", name: "Санкт-Петербург", federalDistrict: "Северо-Западный" },
  { code: "83", name: "Ненецкий автономный округ", federalDistrict: "Северо-Западный" },
  // Южный
  { code: "01", name: "Республика Адыгея", federalDistrict: "Южный" },
  { code: "08", name: "Республика Калмыкия", federalDistrict: "Южный" },
  { code: "23", name: "Краснодарский край", federalDistrict: "Южный" },
  { code: "30", name: "Астраханская область", federalDistrict: "Южный" },
  { code: "34", name: "Волгоградская область", federalDistrict: "Южный" },
  { code: "61", name: "Ростовская область", federalDistrict: "Южный" },
  { code: "91", name: "Республика Крым", federalDistrict: "Южный" },
  { code: "92", name: "Севастополь", federalDistrict: "Южный" },
  // Северо-Кавказский
  { code: "05", name: "Республика Дагестан", federalDistrict: "Северо-Кавказский" },
  { code: "06", name: "Республика Ингушетия", federalDistrict: "Северо-Кавказский" },
  { code: "07", name: "Кабардино-Балкарская Республика", federalDistrict: "Северо-Кавказский" },
  { code: "09", name: "Карачаево-Черкесская Республика", federalDistrict: "Северо-Кавказский" },
  { code: "15", name: "Республика Северная Осетия — Алания", federalDistrict: "Северо-Кавказский" },
  { code: "20", name: "Чеченская Республика", federalDistrict: "Северо-Кавказский" },
  { code: "26", name: "Ставропольский край", federalDistrict: "Северо-Кавказский" },
  // Приволжский
  { code: "02", name: "Республика Башкортостан", federalDistrict: "Приволжский" },
  { code: "12", name: "Республика Марий Эл", federalDistrict: "Приволжский" },
  { code: "13", name: "Республика Мордовия", federalDistrict: "Приволжский" },
  { code: "16", name: "Республика Татарстан", federalDistrict: "Приволжский" },
  { code: "18", name: "Удмуртская Республика", federalDistrict: "Приволжский" },
  { code: "21", name: "Чувашская Республика", federalDistrict: "Приволжский" },
  { code: "59", name: "Пермский край", federalDistrict: "Приволжский" },
  { code: "43", name: "Кировская область", federalDistrict: "Приволжский" },
  { code: "52", name: "Нижегородская область", federalDistrict: "Приволжский" },
  { code: "56", name: "Оренбургская область", federalDistrict: "Приволжский" },
  { code: "58", name: "Пензенская область", federalDistrict: "Приволжский" },
  { code: "63", name: "Самарская область", federalDistrict: "Приволжский" },
  { code: "64", name: "Саратовская область", federalDistrict: "Приволжский" },
  { code: "73", name: "Ульяновская область", federalDistrict: "Приволжский" },
  // Уральский
  { code: "45", name: "Курганская область", federalDistrict: "Уральский" },
  { code: "66", name: "Свердловская область", federalDistrict: "Уральский" },
  { code: "72", name: "Тюменская область", federalDistrict: "Уральский" },
  { code: "74", name: "Челябинская область", federalDistrict: "Уральский" },
  { code: "86", name: "Ханты-Мансийский автономный округ — Югра", federalDistrict: "Уральский" },
  { code: "89", name: "Ямало-Ненецкий автономный округ", federalDistrict: "Уральский" },
  // Сибирский
  { code: "04", name: "Республика Алтай", federalDistrict: "Сибирский" },
  { code: "17", name: "Республика Тыва", federalDistrict: "Сибирский" },
  { code: "19", name: "Республика Хакасия", federalDistrict: "Сибирский" },
  { code: "22", name: "Алтайский край", federalDistrict: "Сибирский" },
  { code: "24", name: "Красноярский край", federalDistrict: "Сибирский" },
  { code: "38", name: "Иркутская область", federalDistrict: "Сибирский" },
  { code: "42", name: "Кемеровская область", federalDistrict: "Сибирский" },
  { code: "54", name: "Новосибирская область", federalDistrict: "Сибирский" },
  { code: "55", name: "Омская область", federalDistrict: "Сибирский" },
  { code: "70", name: "Томская область", federalDistrict: "Сибирский" },
  // Дальневосточный
  { code: "03", name: "Республика Бурятия", federalDistrict: "Дальневосточный" },
  { code: "14", name: "Республика Саха (Якутия)", federalDistrict: "Дальневосточный" },
  { code: "75", name: "Забайкальский край", federalDistrict: "Дальневосточный" },
  { code: "41", name: "Камчатский край", federalDistrict: "Дальневосточный" },
  { code: "25", name: "Приморский край", federalDistrict: "Дальневосточный" },
  { code: "27", name: "Хабаровский край", federalDistrict: "Дальневосточный" },
  { code: "28", name: "Амурская область", federalDistrict: "Дальневосточный" },
  { code: "49", name: "Магаданская область", federalDistrict: "Дальневосточный" },
  { code: "65", name: "Сахалинская область", federalDistrict: "Дальневосточный" },
  { code: "79", name: "Еврейская автономная область", federalDistrict: "Дальневосточный" },
  { code: "87", name: "Чукотский автономный округ", federalDistrict: "Дальневосточный" },
];

export async function seedRegionsIfEmpty(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(regionsTable);
    if (Number(count) > 0) return;

    await db.insert(regionsTable).values(
      RF_REGIONS.map((r) => ({ ...r, status: "active" }))
    );
    logger.info({ count: RF_REGIONS.length }, "Regions seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed regions");
  }
}
