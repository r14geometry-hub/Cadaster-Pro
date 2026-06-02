import { Router } from "express";
import { db, usersTable, ordersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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

    let query = db.select().from(ordersTable).$dynamic();

    const conditions = [];
    if (status) conditions.push(eq(ordersTable.status, status));
    if (serviceType) conditions.push(eq(ordersTable.serviceType, serviceType));
    if (region) conditions.push(eq(ordersTable.region, region));
    if (customerId) conditions.push(eq(ordersTable.customerId, parseInt(customerId)));
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
    const all = await db.select().from(ordersTable)
      .where(eq(ordersTable.status, "open"))
      .orderBy(sql`${ordersTable.createdAt} desc`)
      .limit(6);
    const items = await Promise.all(all.map(formatOrder));
    res.json(items);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/orders", requireAuth, async (req, res) => {
  try {
    const { title, description, serviceType, region, budget, deadline } = req.body;
    if (!title || !description || !serviceType || !region) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }
    const [order] = await db.insert(ordersTable).values({
      customerId: req.user!.userId,
      title, description, serviceType, region,
      budget: budget ?? null,
      deadline: deadline ?? null,
      status: "open",
    }).returning();
    res.status(201).json(await formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const id = parseInt(req.params.orderId);
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
    const id = parseInt(req.params.orderId);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId && req.user!.role !== "admin") {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    const { title, description, status, budget, deadline } = req.body;
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (budget !== undefined) updates.budget = budget;
    if (deadline !== undefined) updates.deadline = deadline;
    const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
    res.json(await formatOrder(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.orderId);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    if (order.customerId !== req.user!.userId && req.user!.role !== "admin") {
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
