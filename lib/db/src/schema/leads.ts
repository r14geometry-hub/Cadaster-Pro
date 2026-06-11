import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { engineersTable } from "./engineers";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  engineerId: integer("engineer_id").notNull().references(() => engineersTable.id),
  serviceType: varchar("service_type", { length: 100 }).notNull(),
  leadCost: integer("lead_cost").notNull().default(0),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("unpaid"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
