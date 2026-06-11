import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, chatRoomsTable, messagesTable } from "@workspace/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function parseJson(s: string): unknown[] {
  try { return JSON.parse(s); } catch { return []; }
}

async function formatRoom(room: typeof chatRoomsTable.$inferSelect, currentUserId: number) {
  const [customer] = await db.select().from(usersTable).where(eq(usersTable.id, room.customerId)).limit(1);
  const { passwordHash: _1, ...safeCustomer } = customer;

  const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, room.engineerId)).limit(1);
  const [engUser] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
  const { passwordHash: _2, ...safeEngUser } = engUser;

  const lastMsg = await db.select().from(messagesTable)
    .where(eq(messagesTable.roomId, room.id))
    .orderBy(sql`${messagesTable.createdAt} desc`)
    .limit(1);

  // Count unread messages NOT sent by current user
  const [{ unread }] = await db.select({ unread: sql<number>`count(*)` })
    .from(messagesTable)
    .where(and(
      eq(messagesTable.roomId, room.id),
      eq(messagesTable.isRead, false),
      ne(messagesTable.senderId, currentUserId)
    ));

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
    engineer: {
      ...eng,
      user: { ...safeEngUser, phone: safeEngUser.phone ?? null, avatarUrl: safeEngUser.avatarUrl ?? null },
      specializations: parseJson(eng.specializations) as string[],
      bio: eng.bio ?? null,
    },
    lastMessage: lastMsg[0]?.text ?? null,
    lastMessageAt: lastMsg[0]?.createdAt?.toISOString() ?? room.lastMessageAt?.toISOString() ?? null,
    unreadCount: Number(unread),
  };
}

router.get("/chats", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, userId)).limit(1);
    const engineerId = eng?.id;

    let rooms: (typeof chatRoomsTable.$inferSelect)[];
    if (engineerId) {
      rooms = await db.select().from(chatRoomsTable)
        .where(eq(chatRoomsTable.engineerId, engineerId))
        .orderBy(sql`COALESCE(${chatRoomsTable.lastMessageAt}, ${chatRoomsTable.createdAt}) desc`);
    } else {
      rooms = await db.select().from(chatRoomsTable)
        .where(eq(chatRoomsTable.customerId, userId))
        .orderBy(sql`COALESCE(${chatRoomsTable.lastMessageAt}, ${chatRoomsTable.createdAt}) desc`);
    }

    res.json(await Promise.all(rooms.map(r => formatRoom(r, userId))));
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
    if (found) { res.json(await formatRoom(found, req.user!.userId)); return; }

    const [room] = await db.insert(chatRoomsTable).values({
      customerId: req.user!.userId,
      engineerId,
      orderId: orderId ?? null,
      lastMessageAt: null,
    }).returning();
    res.json(await formatRoom(room, req.user!.userId));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/chats/:roomId/messages", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId as string);
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.roomId, roomId))
      .orderBy(sql`${messagesTable.createdAt} asc`);

    const result = await Promise.all(msgs.map(async (m) => {
      const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
      const { passwordHash: _, ...safeSender } = sender;
      return { ...m, sender: { ...safeSender, phone: safeSender.phone ?? null, avatarUrl: safeSender.avatarUrl ?? null } };
    }));

    // Mark all messages in this room as read (except own)
    await db.update(messagesTable)
      .set({ isRead: true })
      .where(and(
        eq(messagesTable.roomId, roomId),
        eq(messagesTable.isRead, false),
        ne(messagesTable.senderId, req.user!.userId)
      ));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/chats/:roomId/messages", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId as string);
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: "Text required" }); return; }

    const [msg] = await db.insert(messagesTable).values({
      roomId,
      senderId: req.user!.userId,
      text,
      isRead: false,
    }).returning();

    // Update lastMessageAt on the room
    await db.update(chatRoomsTable)
      .set({ lastMessageAt: msg.createdAt })
      .where(eq(chatRoomsTable.id, roomId));

    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1);
    const { passwordHash: _, ...safeSender } = sender;
    res.status(201).json({ ...msg, sender: { ...safeSender, phone: safeSender.phone ?? null, avatarUrl: safeSender.avatarUrl ?? null } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Mark all messages in a room as read
router.post("/chats/:roomId/read", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId as string);
    await db.update(messagesTable)
      .set({ isRead: true })
      .where(and(
        eq(messagesTable.roomId, roomId),
        eq(messagesTable.isRead, false),
        ne(messagesTable.senderId, req.user!.userId)
      ));
    res.json({ message: "Marked as read" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
