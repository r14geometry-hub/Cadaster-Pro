import { Router } from "express";
import { db, usersTable, ordersTable, engineersTable, reviewsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { calculateWeightedRating } from "./reviews";

const router = Router();

async function formatOrder(order: typeof ordersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.customerId)).limit(1);
  const { passwordHash: _, ...safeUser } = user;
  return {
    ...order,
    customer: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null },
    budget: order.budget ?? null,
    deadline: order.deadline ?? null,
  };
}

router.get("/orders", async (req, res) => {
  try {
    const { status, serviceType, region, customerId, page = "1", limit = "12" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status) conditions.push(eq(ordersTable.status, status));
    if (serviceType) conditions.push(eq(ordersTable.serviceType, serviceType));
    if (region) conditions.push(eq(ordersTable.region, region));
    if (customerId) conditions.push(eq(ordersTable.customerId, parseInt(customerId)));

    let query = db.select().from(ordersTable).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const all = await query.orderBy(sql`${ordersTable.createdAt} desc`).limit(limitNum).offset(offset);
    const items = await Promise.all(all.map(formatOrder));
    res.json({ items, total: Number(count), page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders/recent", async (req, res) => {
  try {
    // Show orders that are new or collecting responses
    const all = await db.select().from(ordersTable)
      .where(sql`${ordersTable.status} IN ('new', 'open', 'collecting_responses')`)
      .orderBy(sql`${ordersTable.createdAt} desc`)
      .limit(6);
    res.json(await Promise.all(all.map(formatOrder)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  try {
    const { title, description, serviceType, region, budget, deadline, asDraft } = req.body;
    if (!title || !description || !serviceType || !region) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }
    const [order] = await db.insert(ordersTable).values({
      customerId: req.user!.userId,
      title, description, serviceType, region,
      budget: budget ?? null,
      deadline: deadline ?? null,
      status: asDraft ? "draft" : "new",
    }).returning();
    res.status(201).json(await formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    res.json(await formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const { title, description, status, budget, deadline } = req.body;
    const isAdmin = req.user!.role === "admin" || req.user!.role === "superadmin";
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      const normalised = status === "open" ? "new" : status;
      if (!isAdmin) {
        // Enforce finite state machine for non-admins
        const CUSTOMER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
          draft:                ["new", "cancelled"],
          new:                  ["cancelled"],
          open:                 ["cancelled"],
          collecting_responses: ["cancelled"],
          engineer_selected:    ["in_progress", "cancelled"],
          in_progress:          ["cancelled"],
          completed:            [],
          cancelled:            [],
        };
        const allowed = CUSTOMER_ALLOWED_TRANSITIONS[order.status] ?? [];
        if (!allowed.includes(normalised)) {
          res.status(400).json({ error: `Invalid status transition from '${order.status}' to '${normalised}'` }); return;
        }
      }
      updates.status = normalised;
    }
    if (budget !== undefined) updates.budget = budget;
    if (deadline !== undefined) updates.deadline = deadline;
    const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
    res.json(await formatOrder(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders/:orderId/complete", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const { rating, comment, engineerId } = req.body;

    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }

    const completable = ["in_progress"];
    if (!completable.includes(order.status)) {
      res.status(400).json({ error: "Order cannot be completed from its current status" }); return;
    }

    await db.update(ordersTable).set({ status: "completed" }).where(eq(ordersTable.id, id));

    let review = null;
    if (rating && engineerId) {
      const [r] = await db.insert(reviewsTable).values({
        orderId: id,
        authorId: req.user!.userId,
        engineerId,
        rating,
        comment: comment ?? null,
        isVerifiedPurchase: true,
        moderationStatus: "pending",
      }).returning();
      review = r;

      // Only increment completedOrders — rating/reviewCount update deferred to moderation publish
      await db.update(engineersTable)
        .set({ completedOrders: sql`${engineersTable.completedOrders} + 1` })
        .where(eq(engineersTable.id, engineerId));
    }

    const updatedOrder = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    res.json({ order: await formatOrder(updatedOrder[0]), review });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId as string);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    await db.delete(ordersTable).where(eq(ordersTable.id, id));
    res.json({ message: "Order deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
