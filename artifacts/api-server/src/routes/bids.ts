import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, bidsTable, chatRoomsTable, leadsTable, leadPricesTable, regionsTable } from "@workspace/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getSetting } from "../lib/seed-lead-prices";

const router = Router();

const DEFAULT_DEBT_LIMIT = 3000;

function parseJson(s: string): unknown[] {
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
    proposedDeadline: bid.proposedDeadline ?? null,
    order: {
      ...order,
      customer: { ...safeCustomer, phone: safeCustomer.phone ?? null, avatarUrl: safeCustomer.avatarUrl ?? null },
      budget: order.budget ?? null,
      deadline: order.deadline ?? null,
    },
    engineer: {
      ...eng,
      user: { ...safeEngUser, phone: safeEngUser.phone ?? null, avatarUrl: safeEngUser.avatarUrl ?? null },
      specializations: parseJson(eng.specializations) as string[],
      bio: eng.bio ?? null,
      responseTime: eng.responseTime ?? null,
      priceFrom: eng.priceFrom ?? null,
      isPro: eng.isPro ?? false,
      proExpiresAt: eng.proExpiresAt ?? null,
      debtAmount: eng.debtAmount ?? 0,
    },
  };
}

router.get("/orders/:orderId/bids", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const bids = await db.select().from(bidsTable)
      .where(eq(bidsTable.orderId, orderId))
      .orderBy(sql`${bidsTable.createdAt} desc`);
    res.json(await Promise.all(bids.map(formatBid)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders/:orderId/bids", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId as string);
    const { message, price, proposedDeadline } = req.body;
    if (!message) { res.status(400).json({ error: "Message required" }); return; }

    const [eng] = await db.select().from(engineersTable)
      .where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(403).json({ error: "Only engineers can bid" }); return; }

    if (!eng.isVerified) {
      res.status(403).json({ error: "Только верифицированные кадастровые инженеры могут откликаться на заявки. Пройдите проверку по реестру Росреестра в личном кабинете." });
      return;
    }

    // Region enforcement — block bids in non-active regions
    const [orderForRegion] = await db.select().from(ordersTable)
      .where(eq(ordersTable.id, orderId)).limit(1);
    if (orderForRegion) {
      const [regionRow] = await db.select().from(regionsTable)
        .where(sql`lower(${regionsTable.name}) = lower(${orderForRegion.region})`).limit(1);
      if (regionRow && regionRow.status !== "active") {
        res.status(403).json({ error: "Подача откликов в данном регионе недоступна." });
        return;
      }
    }

    const debtLimitStr = await getSetting("debt_limit", String(DEFAULT_DEBT_LIMIT));
    const debtLimit = parseInt(debtLimitStr) || DEFAULT_DEBT_LIMIT;

    if ((eng.debtAmount ?? 0) >= debtLimit) {
      res.status(403).json({ error: "Погасите задолженность перед платформой для продолжения" });
      return;
    }

    const existing = await db.select().from(bidsTable)
      .where(and(eq(bidsTable.orderId, orderId), eq(bidsTable.engineerId, eng.id))).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Already submitted a bid on this order" }); return;
    }

    const [bid] = await db.insert(bidsTable).values({
      orderId, engineerId: eng.id, message,
      price: price ?? null,
      proposedDeadline: proposedDeadline ?? null,
      status: "pending",
    }).returning();

    await db.update(ordersTable)
      .set({ bidCount: sql`${ordersTable.bidCount} + 1` })
      .where(eq(ordersTable.id, orderId));

    // Auto-transition: new → collecting_responses on first bid
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
    if (order && (order.status === "new" || order.status === "open")) {
      await db.update(ordersTable)
        .set({ status: "collecting_responses" })
        .where(eq(ordersTable.id, orderId));
    }

    res.status(201).json(await formatBid(bid));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/orders/:orderId/bids/:bidId", requireAuth, async (req, res) => {
  try {
    const bidId = parseInt(req.params.bidId as string);
    const orderId = parseInt(req.params.orderId as string);
    const { status } = req.body;
    if (!status) { res.status(400).json({ error: "Status required" }); return; }

    const [existingBid] = await db.select().from(bidsTable).where(eq(bidsTable.id, bidId)).limit(1);
    if (!existingBid) { res.status(404).json({ error: "Bid not found" }); return; }

    const [updated] = await db.update(bidsTable)
      .set({ status })
      .where(eq(bidsTable.id, bidId))
      .returning();
    if (!updated) { res.status(404).json({ error: "Bid not found" }); return; }

    const wasAlreadyAccepted = existingBid.status === "accepted";

    if (status === "accepted" && !wasAlreadyAccepted) {
      // Transition: → engineer_selected
      await db.update(ordersTable)
        .set({ status: "engineer_selected" })
        .where(eq(ordersTable.id, orderId));

      await db.update(bidsTable)
        .set({ status: "rejected" })
        .where(and(
          eq(bidsTable.orderId, orderId),
          eq(bidsTable.status, "pending"),
          ne(bidsTable.id, bidId)
        ));

      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);

      const existingRoom = await db.select().from(chatRoomsTable)
        .where(and(
          eq(chatRoomsTable.orderId, orderId),
          eq(chatRoomsTable.engineerId, updated.engineerId)
        )).limit(1);

      if (existingRoom.length === 0) {
        await db.insert(chatRoomsTable).values({
          orderId,
          customerId: order.customerId,
          engineerId: updated.engineerId,
          lastMessageAt: null,
        });
      }

      const existingLead = await db.select().from(leadsTable)
        .where(and(eq(leadsTable.orderId, orderId), eq(leadsTable.engineerId, updated.engineerId)))
        .limit(1);

      if (existingLead.length === 0) {
        const [priceRow] = await db.select().from(leadPricesTable)
          .where(eq(leadPricesTable.serviceType, order.serviceType)).limit(1);
        const leadCost = priceRow?.price ?? 500;

        await db.insert(leadsTable).values({
          orderId,
          engineerId: updated.engineerId,
          serviceType: order.serviceType,
          leadCost,
          paymentStatus: "unpaid",
        });

        await db.update(engineersTable)
          .set({ debtAmount: sql`${engineersTable.debtAmount} + ${leadCost}` })
          .where(eq(engineersTable.id, updated.engineerId));
      }
    }

    res.json(await formatBid(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId/bids", async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId as string);
    const bids = await db.select().from(bidsTable)
      .where(eq(bidsTable.engineerId, engineerId))
      .orderBy(sql`${bidsTable.createdAt} desc`);
    res.json(await Promise.all(bids.map(formatBid)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
