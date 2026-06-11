import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engineersTable } from "./engineers";

export const verificationLogsTable = pgTable("verification_logs", {
  id: serial("id").primaryKey(),
  engineerId: integer("engineer_id").references(() => engineersTable.id),
  attestatNumber: varchar("attestat_number", { length: 100 }).notNull(),
  result: varchar("result", { length: 20 }).notNull(),
  failureReason: text("failure_reason"),
  rawSnapshot: text("raw_snapshot"),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

export const insertVerificationLogSchema = createInsertSchema(verificationLogsTable).omit({ id: true, checkedAt: true });
export type InsertVerificationLog = z.infer<typeof insertVerificationLogSchema>;
export type VerificationLog = typeof verificationLogsTable.$inferSelect;
