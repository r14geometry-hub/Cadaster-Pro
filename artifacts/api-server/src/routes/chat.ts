import { Router } from "express";
import multer from "multer";
import { db, usersTable, engineersTable, ordersTable, chatRoomsTable, messagesTable, complaintsTable, bidsTable, chatAttachmentsTable } from "@workspace/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "application/zip",
      "application/x-zip-compressed",
    ];
    const allowedExt = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|zip)$/i;
    if (allowed.includes(file.mimetype) || allowedExt.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Недопустимый тип файла"));
    }
  },
});

const objectStorageService = new ObjectStorageService();

function parseJson(s: string): unknown[] {
  try { return JSON.parse(s); } catch { return []; }
}

/** Returns true if there is an accepted bid linking this room's customer and engineer. */
async function roomContactsUnlocked(room: typeof chatRoomsTable.$inferSelect): Promise<boolean> {
  if (room.orderId) {
    const bids = await db.select({ id: bidsTable.id })
      .from(bidsTable)
      .where(and(
        eq(bidsTable.orderId, room.orderId),
        eq(bidsTable.engineerId, room.engineerId),
        eq(bidsTable.status, "accepted")
      ))
      .limit(1);
    if (bids.length > 0) return true;
  }
  // Fallback: any accepted bid between this customer and engineer
  const bids = await db.select({ id: bidsTable.id })
    .from(bidsTable)
    .innerJoin(ordersTable, eq(bidsTable.orderId, ordersTable.id))
    .where(and(
      eq(bidsTable.engineerId, room.engineerId),
      eq(bidsTable.status, "accepted"),
      eq(ordersTable.customerId, room.customerId)
    ))
    .limit(1);
  return bids.length > 0;
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

  const [{ unread }] = await db.select({ unread: sql<number>`count(*)` })
    .from(messagesTable)
    .where(and(
      eq(messagesTable.roomId, room.id),
      eq(messagesTable.isRead, false),
      ne(messagesTable.senderId, currentUserId)
    ));

  const contactsUnlocked = await roomContactsUnlocked(room);

  let order = null;
  if (room.orderId) {
    const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, room.orderId)).limit(1);
    if (o) {
      order = {
        ...o,
        customer: {
          ...safeCustomer,
          phone: contactsUnlocked ? customer.phone ?? null : null,
          email: contactsUnlocked ? customer.email ?? null : null,
          avatarUrl: customer.avatarUrl ?? null,
        },
        budget: o.budget ?? null,
        deadline: o.deadline ?? null,
      };
    }
  }

  return {
    ...room,
    orderId: room.orderId ?? null,
    order,
    contactsUnlocked,
    customer: {
      ...safeCustomer,
      phone: contactsUnlocked ? customer.phone ?? null : null,
      email: contactsUnlocked ? customer.email ?? null : null,
      telegram: contactsUnlocked ? (customer as { telegram?: string | null }).telegram ?? null : null,
      whatsapp: contactsUnlocked ? (customer as { whatsapp?: string | null }).whatsapp ?? null : null,
      avatarUrl: customer.avatarUrl ?? null,
    },
    engineer: {
      ...eng,
      user: {
        ...safeEngUser,
        phone: contactsUnlocked ? engUser.phone ?? null : null,
        email: contactsUnlocked ? engUser.email ?? null : null,
        telegram: contactsUnlocked ? (engUser as { telegram?: string | null }).telegram ?? null : null,
        whatsapp: contactsUnlocked ? (engUser as { whatsapp?: string | null }).whatsapp ?? null : null,
        avatarUrl: engUser.avatarUrl ?? null,
      },
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
    const userId = req.user!.userId;

    // Verify requester is a member of this room
    const room = await assertRoomMember(roomId, userId);
    if (!room) { res.status(403).json({ error: "Not a member of this chat room" }); return; }

    // Check accepted-bid contact unlock
    const contactsUnlocked = await roomContactsUnlocked(room);

    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.roomId, roomId))
      .orderBy(sql`${messagesTable.createdAt} asc`);

    const result = await Promise.all(msgs.map(async (m) => {
      const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, m.senderId)).limit(1);
      const { passwordHash: _, ...safeSender } = sender;
      return {
        ...m,
        attachmentUrl: m.attachmentUrl ?? null,
        attachmentName: m.attachmentName ?? null,
        attachmentType: m.attachmentType ?? null,
        attachmentSize: m.attachmentSize ?? null,
        sender: {
          ...safeSender,
          phone: contactsUnlocked ? sender.phone ?? null : null,
          email: contactsUnlocked ? sender.email ?? null : null,
          telegram: contactsUnlocked ? (sender as { telegram?: string | null }).telegram ?? null : null,
          whatsapp: contactsUnlocked ? (sender as { whatsapp?: string | null }).whatsapp ?? null : null,
          avatarUrl: sender.avatarUrl ?? null,
        },
      };
    }));

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
    const userId = req.user!.userId;

    // Verify requester is a member of this room
    const roomForSend = await assertRoomMember(roomId, userId);
    if (!roomForSend) { res.status(403).json({ error: "Not a member of this chat room" }); return; }

    const { text, attachmentUrl, attachmentName, attachmentType, attachmentSize } = req.body;

    if (!text && !attachmentUrl) {
      res.status(400).json({ error: "Text or attachment required" }); return;
    }

    // Validate that the attachment URL was server-issued for this room (prevents URL injection)
    if (attachmentUrl) {
      const [grant] = await db.select({ id: chatAttachmentsTable.id })
        .from(chatAttachmentsTable)
        .where(and(
          eq(chatAttachmentsTable.servingUrl, attachmentUrl),
          eq(chatAttachmentsTable.roomId, roomId),
          eq(chatAttachmentsTable.uploaderId, userId),
        ))
        .limit(1);
      if (!grant) {
        res.status(403).json({ error: "Attachment not authorized for this room" });
        return;
      }
    }

    const [msg] = await db.insert(messagesTable).values({
      roomId,
      senderId: req.user!.userId,
      text: text ?? "",
      isRead: false,
      attachmentUrl: attachmentUrl ?? null,
      attachmentName: attachmentName ?? null,
      attachmentType: attachmentType ?? null,
      attachmentSize: attachmentSize != null ? Number(attachmentSize) : null,
    }).returning();

    await db.update(chatRoomsTable)
      .set({ lastMessageAt: msg.createdAt })
      .where(eq(chatRoomsTable.id, roomId));

    const contactsUnlockedForMsg = await roomContactsUnlocked(roomForSend);
    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1);
    const { passwordHash: _, ...safeSender } = sender;
    res.status(201).json({
      ...msg,
      attachmentUrl: msg.attachmentUrl ?? null,
      attachmentName: msg.attachmentName ?? null,
      attachmentType: msg.attachmentType ?? null,
      attachmentSize: msg.attachmentSize ?? null,
      sender: {
        ...safeSender,
        phone: contactsUnlockedForMsg ? sender.phone ?? null : null,
        email: contactsUnlockedForMsg ? sender.email ?? null : null,
        telegram: contactsUnlockedForMsg ? (sender as { telegram?: string | null }).telegram ?? null : null,
        whatsapp: contactsUnlockedForMsg ? (sender as { whatsapp?: string | null }).whatsapp ?? null : null,
        avatarUrl: sender.avatarUrl ?? null,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Helper: check that the requesting user is a member of the room (customer or engineer)
async function assertRoomMember(roomId: number, userId: number): Promise<typeof chatRoomsTable.$inferSelect | null> {
  const [room] = await db.select().from(chatRoomsTable).where(eq(chatRoomsTable.id, roomId)).limit(1);
  if (!room) return null;
  // Is the user the customer?
  if (room.customerId === userId) return room;
  // Is the user the engineer?
  const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, userId)).limit(1);
  if (eng && eng.id === room.engineerId) return room;
  return null;
}

// File upload endpoint
router.post("/chats/:roomId/upload", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId as string);
    const userId = req.user!.userId;

    const room = await assertRoomMember(roomId, userId);
    if (!room) { res.status(403).json({ error: "Not a member of this chat room" }); return; }

    if (!req.file) {
      res.status(400).json({ error: "No file provided" }); return;
    }

    const file = req.file;

    // Get a presigned upload URL from object storage
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Upload file buffer directly to the presigned URL
    const uploadResponse = await fetch(uploadURL, {
      method: "PUT",
      headers: {
        "Content-Type": file.mimetype,
        "Content-Length": String(file.size),
      },
      body: file.buffer,
    });

    if (!uploadResponse.ok) {
      req.log.error({ status: uploadResponse.status }, "Failed to upload to object storage");
      res.status(500).json({ error: "Failed to store file" }); return;
    }

    // The serving URL is /api/storage + objectPath
    const servingUrl = `/api/storage${objectPath}`;

    // Record the server-issued upload grant so the URL can be safely used in messages
    await db.insert(chatAttachmentsTable).values({
      roomId,
      uploaderId: userId,
      servingUrl,
      objectPath,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    res.json({
      url: servingUrl,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Complaint endpoint
router.post("/chats/:roomId/complaint", requireAuth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId as string);
    const userId = req.user!.userId;

    const room = await assertRoomMember(roomId, userId);
    if (!room) { res.status(403).json({ error: "Not a member of this chat room" }); return; }

    const { description } = req.body;
    if (!description || !description.trim()) {
      res.status(400).json({ error: "Description required" }); return;
    }

    const [complaint] = await db.insert(complaintsTable).values({
      roomId,
      reporterId: req.user!.userId,
      description: description.trim(),
      status: "open",
    }).returning();

    const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, complaint.reporterId)).limit(1);

    res.status(201).json({
      ...complaint,
      reporterName: reporter?.name ?? null,
      resolvedAt: complaint.resolvedAt?.toISOString() ?? null,
    });
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
