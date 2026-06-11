import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";

export const regionsTable = pgTable("regions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  federalDistrict: varchar("federal_district", { length: 100 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  comment: text("comment"),
  features: text("features"),
  launchDate: timestamp("launch_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Region = typeof regionsTable.$inferSelect;
