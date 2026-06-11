import { Router } from "express";
import { db, usersTable, engineersTable, ordersTable, leadsTable, leadPricesTable, profileBoostsTable, platformSettingsTable } from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router = Router();

function parseJson(s: string): unknown[] {
  try { return JSON.parse(s); } catch { return []; }
}

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
    const [{ total: totalDebt }] = await db.select({ total: sql<number>`coalesce(sum(lead_cost), 0)` }).from(leadsTable).where(eq(leadsTable.paymentStatus, "unpaid"));
    res.json({
      totalUsers: Number(totalUsers),
      totalEngineers: Number(totalEngineers),
      totalCustomers: Number(totalCustomers),
      totalOrders: Number(totalOrders),
      openOrders: Number(openOrders),
      completedOrders: Number(completedOrders),
      totalRevenue: Number(totalDebt),
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
    const userId = parseInt(req.params.userId as string);
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

// ── Platform Settings ─────────────────────────────────────────────────────────

router.get("/admin/settings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const rows = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.key);
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/settings", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { settings } = req.body as { settings: Record<string, string> };
    if (!settings || typeof settings !== "object") {
      res.status(400).json({ error: "settings object required" }); return;
    }
    for (const [key, value] of Object.entries(settings)) {
      await db.insert(platformSettingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    const rows = await db.select().from(platformSettingsTable).orderBy(platformSettingsTable.key);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Lead Prices ──────────────────────────────────────────────────────────────

router.get("/admin/lead-prices", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const prices = await db.select().from(leadPricesTable).orderBy(leadPricesTable.serviceType);
    res.json(prices);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/admin/lead-prices", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { prices } = req.body as { prices: Array<{ serviceType: string; price: number }> };
    if (!Array.isArray(prices)) { res.status(400).json({ error: "prices array required" }); return; }

    const updated = [];
    for (const { serviceType, price } of prices) {
      const [row] = await db.insert(leadPricesTable)
        .values({ serviceType, price })
        .onConflictDoUpdate({ target: leadPricesTable.serviceType, set: { price, updatedAt: new Date() } })
        .returning();
      updated.push(row);
    }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Leads Management ──────────────────────────────────────────────────────────

router.get("/admin/leads", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { engineerId, paymentStatus, page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 30;
    const offset = (pageNum - 1) * limit;

    let query = db.select().from(leadsTable).$dynamic();
    const conditions = [];
    if (engineerId) conditions.push(eq(leadsTable.engineerId, parseInt(engineerId)));
    if (paymentStatus) conditions.push(eq(leadsTable.paymentStatus, paymentStatus));
    if (conditions.length > 0) query = query.where(and(...conditions));

    const all = await query.orderBy(sql`${leadsTable.createdAt} desc`).limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(leadsTable);

    // Enrich with engineer name
    const enriched = await Promise.all(all.map(async (lead) => {
      const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, lead.engineerId)).limit(1);
      const [user] = eng ? await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1) : [null];
      return {
        ...lead,
        engineerName: user?.name ?? "—",
      };
    }));

    res.json({ items: enriched, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/leads/:leadId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const leadId = parseInt(req.params.leadId as string);
    const { paymentStatus } = req.body;
    if (!paymentStatus) { res.status(400).json({ error: "paymentStatus required" }); return; }

    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

    const [updated] = await db.update(leadsTable)
      .set({ paymentStatus })
      .where(eq(leadsTable.id, leadId))
      .returning();

    // Keep debtAmount in sync with payment status transitions
    if (paymentStatus === "paid" && lead.paymentStatus === "unpaid") {
      // Marking paid: reduce debt
      await db.update(engineersTable)
        .set({ debtAmount: sql`greatest(0, ${engineersTable.debtAmount} - ${lead.leadCost})` })
        .where(eq(engineersTable.id, lead.engineerId));
    } else if (paymentStatus === "unpaid" && lead.paymentStatus === "paid") {
      // Reversing to unpaid: restore debt
      await db.update(engineersTable)
        .set({ debtAmount: sql`${engineersTable.debtAmount} + ${lead.leadCost}` })
        .where(eq(engineersTable.id, lead.engineerId));
    }

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Per-engineer debt summary
router.get("/admin/leads/summary", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const engineers = await db.select().from(engineersTable).orderBy(sql`${engineersTable.debtAmount} desc`);
    const summary = await Promise.all(engineers.map(async (eng) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
      const allLeads = await db.select().from(leadsTable).where(eq(leadsTable.engineerId, eng.id));
      const totalAccrued = allLeads.reduce((s, l) => s + l.leadCost, 0);
      const totalPaid = allLeads.filter(l => l.paymentStatus === "paid").reduce((s, l) => s + l.leadCost, 0);
      return {
        engineerId: eng.id,
        engineerName: user?.name ?? "—",
        debtAmount: eng.debtAmount ?? 0,
        totalAccrued,
        totalPaid,
        leadCount: allLeads.length,
      };
    }));
    res.json(summary.filter(s => s.totalAccrued > 0));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PRO & Boost controls ──────────────────────────────────────────────────────

router.get("/admin/engineers", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    const engineers = await db.select().from(engineersTable)
      .orderBy(sql`${engineersTable.createdAt} desc`)
      .limit(limit).offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(engineersTable);

    const now = new Date();
    const activeBoosts = await db.select().from(profileBoostsTable).where(gte(profileBoostsTable.expiresAt, now));
    const boostMap = new Map(activeBoosts.map(b => [b.engineerId, b]));

    const items = await Promise.all(engineers.map(async (eng) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
      return {
        id: eng.id,
        userId: eng.userId,
        name: user?.name ?? "—",
        email: user?.email ?? "—",
        region: eng.region,
        rating: eng.rating,
        isVerified: eng.isVerified,
        isPro: eng.isPro,
        proExpiresAt: eng.proExpiresAt ?? null,
        debtAmount: eng.debtAmount ?? 0,
        specializations: parseJson(eng.specializations) as string[],
        activeBoost: boostMap.get(eng.id) ?? null,
      };
    }));

    res.json({ items, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/engineers/:engineerId", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const engineerId = parseInt(req.params.engineerId as string);
    const { isPro, proExpiresAt, boostPeriod } = req.body;

    const updates: Record<string, unknown> = {};
    if (isPro !== undefined) updates.isPro = isPro;
    if (proExpiresAt !== undefined) updates.proExpiresAt = proExpiresAt ? new Date(proExpiresAt) : null;

    if (Object.keys(updates).length > 0) {
      await db.update(engineersTable).set(updates).where(eq(engineersTable.id, engineerId));
    }

    if (boostPeriod) {
      const days = parseInt(boostPeriod);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      await db.insert(profileBoostsTable).values({ engineerId, period: days, expiresAt });
    }

    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, engineerId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
    const now = new Date();
    const activeBoosts = await db.select().from(profileBoostsTable)
      .where(and(eq(profileBoostsTable.engineerId, engineerId), gte(profileBoostsTable.expiresAt, now)));

    res.json({
      id: eng.id,
      name: user?.name ?? "—",
      isPro: eng.isPro,
      proExpiresAt: eng.proExpiresAt ?? null,
      debtAmount: eng.debtAmount ?? 0,
      activeBoost: activeBoosts[activeBoosts.length - 1] ?? null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
