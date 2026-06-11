import { pgTable, serial, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: varchar("value", { length: 500 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PlatformSetting = typeof platformSettingsTable.$inferSelect;
