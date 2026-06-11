import { db, leadPricesTable, platformSettingsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_LEAD_PRICES: Array<{ serviceType: string; price: number }> = [
  { serviceType: "Межевание", price: 500 },
  { serviceType: "Техплан", price: 700 },
  { serviceType: "Межевой план", price: 500 },
  { serviceType: "Технический план", price: 700 },
  { serviceType: "Вынос границ", price: 300 },
  { serviceType: "Кадастровый паспорт", price: 400 },
  { serviceType: "Постановка на учёт", price: 400 },
  { serviceType: "Снятие с учёта", price: 350 },
  { serviceType: "Оценка", price: 600 },
  { serviceType: "Обследование", price: 450 },
  { serviceType: "Перераспределение", price: 500 },
];

const DEFAULT_PLATFORM_SETTINGS: Array<{ key: string; value: string }> = [
  { key: "debt_limit", value: "3000" },
  { key: "boost_price_7d", value: "500" },
  { key: "boost_price_30d", value: "1500" },
  { key: "boost_price_90d", value: "3500" },
];

export async function seedLeadPricesIfEmpty(): Promise<void> {
  try {
    const [{ count: leadPriceCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadPricesTable);

    if (Number(leadPriceCount) === 0) {
      await db.insert(leadPricesTable).values(DEFAULT_LEAD_PRICES).onConflictDoNothing();
      logger.info({ count: DEFAULT_LEAD_PRICES.length }, "Lead prices seeded");
    }

    const [{ count: settingsCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformSettingsTable);

    if (Number(settingsCount) === 0) {
      await db.insert(platformSettingsTable).values(DEFAULT_PLATFORM_SETTINGS).onConflictDoNothing();
      logger.info({ count: DEFAULT_PLATFORM_SETTINGS.length }, "Platform settings seeded");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed defaults");
  }
}

/** Fetch a single platform setting by key, with fallback */
export async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(platformSettingsTable)
      .where(sql`${platformSettingsTable.key} = ${key}`)
      .limit(1);
    return row?.value ?? fallback;
  } catch {
    return fallback;
  }
}
