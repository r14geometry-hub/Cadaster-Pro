import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, bidsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function parseSpecializations(s: string): string[] {
  try { return JSON.parse(s); } catch { return []; }
}

async function formatBid(bid: typeof bidsTable.$inferSelect) {
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, bid.orderId)).limit(1);
  const [orderCustomer] = await db.select().from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1);
  const { passwordHash: _1, ...safeCustomer } = orderCustomer;

  const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, bid.engineerId)).limit(1);
  const [engUser] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
  const { passwordHash: _2, ...safeEngUser } = engUser;

  return {
    ...bid,
    price: bid.price ?? null,
    order: { ...order, customer: { ...safeCustomer, phone: safeCustomer.phone ?? null, avatarUrl: safeCustomer.avatarUrl ?? null }, budget: order.budget ?? null, deadline: order.deadline ?? null },
    engineer: { ...eng, user: { ...safeEngUser, phone: safeEngUser.phone ?? null, avatarUrl: safeEngUser.avatarUrl ?? null }, specializations: parseSpecializations(eng.specializations), bio: eng.bio ?? null },
  };
}

router.get("/orders/:orderId/bids", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const bids = await db.select().from(bidsTable).where(eq(bidsTable.orderId, orderId)).orderBy(sql`${bidsTable.createdAt} desc`);
    res.json(await Promise.all(bids.map(formatBid)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders/:orderId/bids", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    const { message, price } = req.body;
    if (!message) { res.status(400).json({ error: "Message required" }); return; }

    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(403).json({ error: "Only engineers can bid" }); return; }

    const [bid] = await db.insert(bidsTable).values({
      orderId, engineerId: eng.id, message, price: price ?? null, status: "pending",
    }).returning();

    await db.update(ordersTable).set({ bidCount: sql`${ordersTable.bidCount} + 1` }).where(eq(ordersTable.id, orderId));

    res.status(201).json(await formatBid(bid));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/orders/:orderId/bids/:bidId", requireAuth, async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId);
    const { status } = req.body;
    if (!status) { res.status(400).json({ error: "Status required" }); return; }
    const [updated] = await db.update(bidsTable).set({ status }).where(eq(bidsTable.id, bidId)).returning();
    if (!updated) { res.status(404).json({ error: "Bid not found" }); return; }

    if (status === "accepted") {
      await db.update(ordersTable).set({ status: "in_progress" }).where(eq(ordersTable.id, updated.orderId));
    }

    res.json(await formatBid(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId/bids", async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId);
    const bids = await db.select().from(bidsTable).where(eq(bidsTable.engineerId, engineerId)).orderBy(sql`${bidsTable.createdAt} desc`);
    res.json(await Promise.all(bids.map(formatBid)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
