import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadPricesTable = pgTable("lead_prices", {
  id: serial("id").primaryKey(),
  serviceType: varchar("service_type", { length: 100 }).notNull().unique(),
  price: integer("price").notNull().default(500),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeadPriceSchema = createInsertSchema(leadPricesTable).omit({ id: true, updatedAt: true });
export type InsertLeadPrice = z.infer<typeof insertLeadPriceSchema>;
export type LeadPrice = typeof leadPricesTable.$inferSelect;
