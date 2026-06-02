import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, bidsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/admin/stats", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const [{ total: totalUsers }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable);
    const [{ total: totalEngineers }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable);
    const [{ total: totalCustomers }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable).where(eq(usersTable.role, "customer"));
    const [{ total: totalOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable);
    const [{ total: openOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "open"));
    const [{ total: completedOrders }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "completed"));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [{ total: newUsersThisMonth }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable).where(sql`${usersTable.createdAt} >= ${monthStart.toISOString()}`);
    res.json({
      totalUsers: Number(totalUsers),
      totalEngineers: Number(totalEngineers),
      totalCustomers: Number(totalCustomers),
      totalOrders: Number(totalOrders),
      openOrders: Number(openOrders),
      completedOrders: Number(completedOrders),
      totalRevenue: 0,
      newUsersThisMonth: Number(newUsersThisMonth),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { role, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;
    let query = db.select().from(usersTable).$dynamic();
    if (role) query = query.where(eq(usersTable.role, role));
    const all = await query.orderBy(sql`${usersTable.createdAt} desc`).limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(usersTable);
    const items = all.map(({ passwordHash: _, ...u }) => ({ ...u, phone: u.phone ?? null, avatarUrl: u.avatarUrl ?? null }));
    res.json({ items, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/users/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { role, isBlocked } = req.body;
    const updates: Record<string, unknown> = {};
    if (role !== undefined) updates.role = role;
    if (isBlocked !== undefined) updates.isBlocked = isBlocked ? "true" : "false";
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    const { passwordHash: _, ...safe } = updated;
    res.json({ ...safe, phone: safe.phone ?? null, avatarUrl: safe.avatarUrl ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin/orders", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { status, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;
    let query = db.select().from(ordersTable).$dynamic();
    if (status) query = query.where(eq(ordersTable.status, status));
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(ordersTable);
    const all = await query.orderBy(sql`${ordersTable.createdAt} desc`).limit(limit).offset(offset);
    const items = all.map(o => ({ ...o, budget: o.budget ?? null, deadline: o.deadline ?? null }));
    res.json({ items, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
