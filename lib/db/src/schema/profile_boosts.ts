import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engineersTable } from "./engineers";

export const profileBoostsTable = pgTable("profile_boosts", {
  id: serial("id").primaryKey(),
  engineerId: integer("engineer_id").notNull().references(() => engineersTable.id),
  period: integer("period").notNull().default(7),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProfileBoostSchema = createInsertSchema(profileBoostsTable).omit({ id: true, createdAt: true });
export type InsertProfileBoost = z.infer<typeof insertProfileBoostSchema>;
export type ProfileBoost = typeof profileBoostsTable.$inferSelect;
