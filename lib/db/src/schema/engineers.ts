import { pgTable, serial, integer, varchar, text, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const engineersTable = pgTable("engineers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  registryNumber: varchar("registry_number", { length: 100 }).notNull().unique(),
  specializations: text("specializations").notNull().default("[]"),
  region: varchar("region", { length: 255 }).notNull(),
  regions: text("regions").notNull().default("[]"),
  district: varchar("district", { length: 255 }),
  sro: text("sro"),
  experience: integer("experience").notNull().default(0),
  bio: text("bio"),
  isVerified: boolean("is_verified").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  isHidden: boolean("is_hidden").notNull().default(false),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  completedOrders: integer("completed_orders").notNull().default(0),
  responseTime: varchar("response_time", { length: 100 }).default("в течение дня"),
  priceFrom: integer("price_from"),
  portfolioItems: text("portfolio_items").notNull().default("[]"),
  isPro: boolean("is_pro").notNull().default(false),
  proExpiresAt: timestamp("pro_expires_at"),
  debtAmount: integer("debt_amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  serviceAreas: text("service_areas").notNull().default("[]"),
  attestatNumber: varchar("attestat_number", { length: 100 }).unique(),
  rosreestrStatus: varchar("rosreestr_status", { length: 50 }),
  sroName: text("sro_name"),
  rosreestrCheckedAt: timestamp("rosreestr_checked_at"),
  rosreestrWorksCount: integer("rosreestr_works_count"),
  rosreestrRejectionsCount: integer("rosreestr_rejections_count"),
  rosreestrSuspensionsCount: integer("rosreestr_suspensions_count"),
  rosreestrRejectionRate: real("rosreestr_rejection_rate"),
});

export const insertEngineerSchema = createInsertSchema(engineersTable).omit({ id: true, createdAt: true });
export type InsertEngineer = z.infer<typeof insertEngineerSchema>;
export type Engineer = typeof engineersTable.$inferSelect;
