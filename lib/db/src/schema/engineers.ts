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
  experience: integer("experience").notNull().default(0),
  bio: text("bio"),
  isVerified: boolean("is_verified").notNull().default(false),
  isOnline: boolean("is_online").notNull().default(false),
  rating: real("rating").notNull().default(0),
  reviewCount: integer("review_count").notNull().default(0),
  completedOrders: integer("completed_orders").notNull().default(0),
  responseTime: varchar("response_time", { length: 100 }).default("в течение дня"),
  priceFrom: integer("price_from"),
  portfolioItems: text("portfolio_items").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEngineerSchema = createInsertSchema(engineersTable).omit({ id: true, createdAt: true });
export type InsertEngineer = z.infer<typeof insertEngineerSchema>;
export type Engineer = typeof engineersTable.$inferSelect;
