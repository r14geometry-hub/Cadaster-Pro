import { pgTable, serial, integer, text, real, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { engineersTable } from "./engineers";

export const bidsTable = pgTable("bids", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id),
  engineerId: integer("engineer_id").notNull().references(() => engineersTable.id),
  message: text("message").notNull(),
  price: real("price"),
  proposedDeadline: varchar("proposed_deadline", { length: 100 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true });
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
