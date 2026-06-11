import { pgTable, serial, integer, varchar, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => usersTable.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").notNull(),
  serviceType: varchar("service_type", { length: 100 }).notNull(),
  region: varchar("region", { length: 255 }).notNull(),
  budget: real("budget"),
  deadline: varchar("deadline", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("new"),
  district: varchar("district", { length: 255 }),
  locality: varchar("locality", { length: 255 }),
  address: varchar("address", { length: 500 }),
  bidCount: integer("bid_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, bidCount: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
