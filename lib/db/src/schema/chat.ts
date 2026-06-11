import { pgTable, serial, integer, text, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { engineersTable } from "./engineers";
import { ordersTable } from "./orders";

export const chatRoomsTable = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => ordersTable.id),
  customerId: integer("customer_id").notNull().references(() => usersTable.id),
  engineerId: integer("engineer_id").notNull().references(() => engineersTable.id),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRoomsTable.id),
  senderId: integer("sender_id").notNull().references(() => usersTable.id),
  text: text("text").notNull().default(""),
  isRead: boolean("is_read").notNull().default(false),
  attachmentUrl: text("attachment_url"),
  attachmentName: varchar("attachment_name", { length: 500 }),
  attachmentType: varchar("attachment_type", { length: 100 }),
  attachmentSize: integer("attachment_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Tracks server-issued upload grants so arbitrary URLs cannot be injected into messages. */
export const chatAttachmentsTable = pgTable("chat_attachments", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRoomsTable.id),
  uploaderId: integer("uploader_id").notNull().references(() => usersTable.id),
  servingUrl: text("serving_url").notNull(),
  objectPath: text("object_path").notNull(),
  originalName: varchar("original_name", { length: 500 }),
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChatRoomSchema = createInsertSchema(chatRoomsTable).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });

export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ChatRoom = typeof chatRoomsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type ChatAttachment = typeof chatAttachmentsTable.$inferSelect;
