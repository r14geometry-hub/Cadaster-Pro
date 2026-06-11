import { pgTable, serial, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const paymentRequisitesTable = pgTable("payment_requisites", {
  id: serial("id").primaryKey(),
  recipientType: varchar("recipient_type", { length: 20 }).notNull().default("individual"),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  cardNumber: varchar("card_number", { length: 30 }),
  phone: varchar("phone", { length: 30 }),
  bank: varchar("bank", { length: 255 }),
  email: varchar("email", { length: 255 }),
  paymentComment: text("payment_comment"),
  status: varchar("status", { length: 20 }).notNull().default("archive"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => usersTable.id),
});

export const paymentRequisitesLogTable = pgTable("payment_requisites_log", {
  id: serial("id").primaryKey(),
  requisiteId: integer("requisite_id").references(() => paymentRequisitesTable.id),
  changedBy: integer("changed_by").references(() => usersTable.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  action: varchar("action", { length: 50 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }),
  oldValue: text("old_value"),
  newValue: text("new_value"),
});

export type PaymentRequisite = typeof paymentRequisitesTable.$inferSelect;
export type InsertPaymentRequisite = typeof paymentRequisitesTable.$inferInsert;
export type PaymentRequisiteLog = typeof paymentRequisitesLogTable.$inferSelect;
