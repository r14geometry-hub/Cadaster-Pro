import { Router } from "express";
import { db, usersTable, engineersTable, profileBoostsTable, leadsTable, platformSettingsTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function parseJson(s: string): unknown[] {
  try { return JSON.parse(s); } catch { return []; }
}

async function formatEngineer(eng: typeof engineersTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, eng.userId)).limit(1);
  const { passwordHash: _, ...safeUser } = user;
  const now = new Date();
  const activePro = eng.isPro && (!eng.proExpiresAt || eng.proExpiresAt > now);
  return {
    ...eng,
    user: { ...safeUser, phone: safeUser.phone ?? null, avatarUrl: safeUser.avatarUrl ?? null },
    specializations: parseJson(eng.specializations) as string[],
    regions: parseJson(eng.regions) as string[],
    portfolioItems: parseJson(eng.portfolioItems),
    bio: eng.bio ?? null,
    responseTime: eng.responseTime ?? "в течение дня",
    priceFrom: eng.priceFrom ?? null,
    isOnline: eng.isOnline ?? false,
    isPro: activePro,
    proExpiresAt: eng.proExpiresAt ?? null,
    debtAmount: eng.debtAmount ?? 0,
  };
}

router.get("/settings", async (req, res) => {
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

router.get("/engineers", async (req, res) => {
  try {
    const { region, specialization, minRating, search, page = "1", limit = "12" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (region) conditions.push(eq(engineersTable.region, region));
    if (minRating) conditions.push(gte(engineersTable.rating, parseFloat(minRating)));

    let query = db.select().from(engineersTable).$dynamic();
    if (conditions.length > 0) query = query.where(and(...conditions));

    const allResults = await query.limit(200);
    let formatted = await Promise.all(allResults.map(formatEngineer));

    if (search) {
      const s = search.toLowerCase();
      formatted = formatted.filter(e =>
        e.user.name.toLowerCase().includes(s) ||
        e.region.toLowerCase().includes(s) ||
        e.specializations.some((sp: string) => sp.toLowerCase().includes(s))
      );
    }
    if (specialization) {
      formatted = formatted.filter(e => e.specializations.includes(specialization));
    }

    const now = new Date();

    // Fetch active boosts for all engineers
    const activeBoosts = await db.select().from(profileBoostsTable)
      .where(gte(profileBoostsTable.expiresAt, now));
    const boostedEngIds = new Set(activeBoosts.map(b => b.engineerId));

    const DEBT_LIMIT = 3000;

    // Sort: PRO first, then boosted, then by rating; debt-restricted last
    formatted.sort((a, b) => {
      const aDebtBlock = a.debtAmount >= DEBT_LIMIT;
      const bDebtBlock = b.debtAmount >= DEBT_LIMIT;
      if (aDebtBlock !== bDebtBlock) return aDebtBlock ? 1 : -1;
      const aPro = a.isPro;
      const bPro = b.isPro;
      if (aPro !== bPro) return aPro ? -1 : 1;
      const aBoosted = boostedEngIds.has(a.id);
      const bBoosted = boostedEngIds.has(b.id);
      if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
      return b.rating - a.rating;
    });

    const total = formatted.length;
    const items = formatted.slice(offset, offset + limitNum);
    res.json({ items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/top", async (req, res) => {
  try {
    const all = await db.select().from(engineersTable)
      .orderBy(sql`${engineersTable.rating} desc, ${engineersTable.reviewCount} desc`)
      .limit(6);
    res.json(await Promise.all(all.map(formatEngineer)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/me/leads", requireAuth, async (req, res) => {
  try {
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }

    const { page = "1" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limit = 30;
    const offset = (pageNum - 1) * limit;

    const leads = await db.select().from(leadsTable)
      .where(eq(leadsTable.engineerId, eng.id))
      .orderBy(sql`${leadsTable.createdAt} desc`)
      .limit(limit).offset(offset);

    const [{ total }] = await db.select({ total: sql<number>`count(*)` })
      .from(leadsTable).where(eq(leadsTable.engineerId, eng.id));

    res.json({ items: leads, total: Number(total), page: pageNum, limit });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/me/balance", requireAuth, async (req, res) => {
  try {
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }

    const allLeads = await db.select().from(leadsTable).where(eq(leadsTable.engineerId, eng.id));
    const totalAccrued = allLeads.reduce((s, l) => s + l.leadCost, 0);
    const totalPaid = allLeads.filter(l => l.paymentStatus === "paid").reduce((s, l) => s + l.leadCost, 0);

    res.json({
      debtAmount: eng.debtAmount ?? 0,
      totalAccrued,
      totalPaid,
      leadCount: allLeads.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/me", requireAuth, async (req, res) => {
  try {
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }
    res.json(await formatEngineer(eng));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/engineers/me", requireAuth, async (req, res) => {
  try {
    const { specializations, region, regions, experience, bio, phone, responseTime, priceFrom, isOnline, portfolioItems } = req.body;
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }
    const updates: Record<string, unknown> = {};
    if (specializations !== undefined) updates.specializations = JSON.stringify(specializations);
    if (region !== undefined) updates.region = region;
    if (regions !== undefined) updates.regions = JSON.stringify(regions);
    if (experience !== undefined) updates.experience = experience;
    if (bio !== undefined) updates.bio = bio;
    if (responseTime !== undefined) updates.responseTime = responseTime;
    if (priceFrom !== undefined) updates.priceFrom = priceFrom;
    if (isOnline !== undefined) updates.isOnline = isOnline;
    if (portfolioItems !== undefined) updates.portfolioItems = JSON.stringify(portfolioItems);
    const [updated] = await db.update(engineersTable).set(updates).where(eq(engineersTable.id, eng.id)).returning();
    if (phone !== undefined) await db.update(usersTable).set({ phone }).where(eq(usersTable.id, req.user!.userId));
    res.json(await formatEngineer(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/engineers/verify", requireAuth, async (req, res) => {
  try {
    const { registryNumber } = req.body;
    if (!registryNumber) { res.status(400).json({ error: "registryNumber required" }); return; }
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.userId, req.user!.userId)).limit(1);
    const isValid = registryNumber.length >= 5;
    if (isValid && eng) {
      await db.update(engineersTable).set({ registryNumber, isVerified: true }).where(eq(engineersTable.id, eng.id));
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
    res.json({ isValid, engineerName: isValid ? user.name : null, message: isValid ? "Номер подтверждён в реестре Росреестра" : "Номер не найден в реестре" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId", async (req, res) => {
  try {
    const id = parseInt(req.params.engineerId);
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, id)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }
    res.json(await formatEngineer(eng));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
