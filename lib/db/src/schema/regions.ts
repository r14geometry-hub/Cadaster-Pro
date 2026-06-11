import { pgTable, serial, varchar, text, timestamp, integer, real } from "drizzle-orm/pg-core";

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
  monetizationModel: varchar("monetization_model", { length: 20 }).notNull().default("global"),
  fixedLeadFee: integer("fixed_lead_fee").notNull().default(0),
  percentFee: real("percent_fee").notNull().default(0),
});

export type Region = typeof regionsTable.$inferSelect;
