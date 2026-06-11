import { db, leadPricesTable } from "@workspace/db";
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

export async function seedLeadPricesIfEmpty(): Promise<void> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leadPricesTable);

    if (Number(count) > 0) return; // already seeded

    await db
      .insert(leadPricesTable)
      .values(DEFAULT_LEAD_PRICES)
      .onConflictDoNothing();

    logger.info({ count: DEFAULT_LEAD_PRICES.length }, "Lead prices seeded");
  } catch (err) {
    logger.error({ err }, "Failed to seed lead prices");
  }
}
