import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, chatRoomsTable, messagesTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function parseSpecializations(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

async function formatRoom(room: typeof chatRoomsTable.$inferSelect) {
  const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, room.customerId)).limit(1);
  const { passwordHash: _1, ...safeCustomer } = customer;

  const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, room.engineerId)).limit(1);
  const [engUser] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
  const { passwordHash: _2, ...safeEngUser } = engUser;

  const lastMsg = await db.select().from(messagesTable).where(eq(messagesTable.roomId, room.id)).orderBy(sql`${messagesTable.createdAt} desc`).limit(1);
  const unreadCount = 0;

  let order = null;
  if (room.orderId) {
    const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, room.orderId)).limit(1);
    if (o) {
      order = { ...o, customer: { ...safeCustomer, phone: safeCustomer.phone ?? null, avatarUrl: safeCustomer.avatarUrl ?? null }, budget: o.budget ?? null, deadline: o.deadline ?? null };
    }
  }

  return {
    ...room,
    orderId: room.orderId ?? null,
    order,
    customer: { ...safeCustomer, phone: safeCustomer.phone ?? null, avatarUrl: safeCustomer.avatarUrl ?? null },
    engineer: { ...eng, user: { ...safeEngUser, phone: safeEngUser.phone ?? null, avatarUrl: safeEngUser.avatarUrl ?? null }, specializations: parseSpecializations(eng.specializations), bio: eng.bio ?? null },
    lastMessage: lastMsg[0]?.text ?? null,
    lastMessageAt: lastMsg[0]?.createdAt?.toISOString() ?? null,
    unreadCount,
  };
}

router.get("/chats", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, userId)).limit(1);
    const engineerId = eng?.id;

    let rooms: (typeof chatRoomsTable.$inferSelect)[];
    if (engineerId) {
      rooms = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.engineerId, engineerId)).orderBy(sql`${chatRoomsTable.createdAt} desc`);
    } else {
      rooms = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.customerId, userId)).orderBy(sql`${chatRoomsTable.createdAt} desc`);
    }

    res.json(await Promise.all(rooms.map(formatRoom)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/chats", requireAuth, async (req, res) => {
  try {
    const { engineerId, orderId } = req.body;
    if (!engineerId) { res.status(400).json({ error: "engineerId required" }); return; }

    const existing = await db.select().from(chatRoomsTable)
      .where(eq(chatRoomsTable.customerId, req.user!.userId))
      .limit(100);
    const found = existing.find(r => r.engineerId === engineerId && (orderId ? r.orderId === orderId : true));
    if (found) { res.json(await formatRoom(found)); return; }

    const [room] = await db.insert(chatRoomsTable).values({
      customerId: req.user!.userId,
      engineerId,
      orderId: orderId ?? null,
    }).returning();
    res.json(await formatRoom(room));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/chats/:roomId/messages", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const msgs = await db.select().from(messagesTable).where(eq(messagesTable.roomId, roomId)).orderBy(sql`${messagesTable.createdAt} asc`);
    const result = await Promise.all(msgs.map(async (m) => {
      const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
      const { passwordHash: _, ...safeSender } = sender;
      return { ...m, sender: { ...safeSender, phone: safeSender.phone ?? null, avatarUrl: safeSender.avatarUrl ?? null } };
    }));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/chats/:roomId/messages", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: "Text required" }); return; }
    const [msg] = await db.insert(messagesTable).values({ roomId, senderId: req.user!.userId, text }).returning();
    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1);
    const { passwordHash: _, ...safeSender } = sender;
    res.status(201).json({ ...msg, sender: { ...safeSender, phone: safeSender.phone ?? null, avatarUrl: safeSender.avatarUrl ?? null } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
