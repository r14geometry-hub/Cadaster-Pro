import { Router } from "express";
import { db, usersTable, engineersTable, profileBoostsTable, leadsTable, platformSettingsTable, verificationLogsTable, bidsTable, ordersTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { rosreestrProvider, computeRatingFromRosreestr } from "../services/rosreestr";

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
    user: {
      ...safeUser,
      phone: safeUser.phone ?? null,
      telegram: safeUser.telegram ?? null,
      whatsapp: safeUser.whatsapp ?? null,
      avatarUrl: safeUser.avatarUrl ?? null,
    },
    specializations: parseJson(eng.specializations) as string[],
    regions: parseJson(eng.regions) as string[],
    portfolioItems: parseJson(eng.portfolioItems),
    bio: eng.bio ?? null,
    responseTime: eng.responseTime ?? "в течение дня",
    priceFrom: eng.priceFrom ?? null,
    isOnline: eng.isOnline ?? false,
    isHidden: eng.isHidden ?? false,
    district: eng.district ?? null,
    sro: eng.sro ?? null,
    isPro: activePro,
    proExpiresAt: eng.proExpiresAt ?? null,
    debtAmount: eng.debtAmount ?? 0,
    attestatNumber: eng.attestatNumber ?? null,
    rosreestrStatus: eng.rosreestrStatus ?? null,
    sroName: eng.sroName ?? null,
    rosreestrCheckedAt: eng.rosreestrCheckedAt ?? null,
    rosreestrWorksCount: eng.rosreestrWorksCount ?? null,
    rosreestrRejectionsCount: eng.rosreestrRejectionsCount ?? null,
    rosreestrSuspensionsCount: eng.rosreestrSuspensionsCount ?? null,
    rosreestrRejectionRate: eng.rosreestrRejectionRate ?? null,
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
    const { region, specialization, minRating, search, district, sro, verifiedOnly, page = "1", limit = "12" } = req.query as Record<string, string>;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (region) conditions.push(eq(engineersTable.region, region));
    if (minRating) conditions.push(gte(engineersTable.rating, parseFloat(minRating)));
    if (district) conditions.push(eq(engineersTable.district, district));
    // Filter out hidden engineers from public listing
    conditions.push(eq(engineersTable.isHidden, false));

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
    if (sro) {
      const sroLower = sro.toLowerCase();
      formatted = formatted.filter(e =>
        (e.sroName ?? "").toLowerCase().includes(sroLower) ||
        (e.sro ?? "").toLowerCase().includes(sroLower)
      );
    }
    if (verifiedOnly === "true") {
      formatted = formatted.filter(e => e.isVerified);
    }

    const now = new Date();

    const activeBoosts = await db.select().from(profileBoostsTable)
      .where(gte(profileBoostsTable.expiresAt, now));
    const boostedEngIds = new Set(activeBoosts.map(b => b.engineerId));

    const DEBT_LIMIT = 3000;

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
      .where(eq(engineersTable.isHidden, false))
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
    const userUpdates: Record<string, unknown> = {};
    if (phone !== undefined) userUpdates.phone = phone;
    if (req.body.telegram !== undefined) userUpdates.telegram = req.body.telegram;
    if (req.body.whatsapp !== undefined) userUpdates.whatsapp = req.body.whatsapp;
    if (Object.keys(userUpdates).length > 0) {
      await db.update(usersTable).set(userUpdates).where(eq(usersTable.id, req.user!.userId));
    }
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
    if (!eng) { res.status(404).json({ error: "Engineer profile not found" }); return; }

    const record = await rosreestrProvider.lookupByAttestat(registryNumber);

    if (!record) {
      await db.insert(verificationLogsTable).values({
        engineerId: eng.id,
        attestatNumber: registryNumber,
        result: "fail",
        failureReason: "Номер аттестата не найден в реестре Росреестра",
        rawSnapshot: null,
      });
      res.status(400).json({
        isValid: false,
        engineerName: null,
        message: "Номер аттестата не найден в реестре Росреестра. Проверьте правильность номера.",
      });
      return;
    }

    if (record.status !== "active") {
      const statusLabel = record.status === "suspended" ? "приостановлен" : "аннулирован";
      const reason = `Статус инженера в реестре: ${statusLabel}`;
      await db.insert(verificationLogsTable).values({
        engineerId: eng.id,
        attestatNumber: registryNumber,
        result: "fail",
        failureReason: reason,
        rawSnapshot: JSON.stringify(record),
      });
      res.status(400).json({
        isValid: false,
        engineerName: record.engineerName,
        message: `Верификация невозможна: аттестат кадастрового инженера ${statusLabel}. Для получения доступа необходимо восстановить действующий статус в Росреестре.`,
      });
      return;
    }

    if (record.sroStatus !== "active") {
      const reason = "Членство в СРО не является действующим";
      await db.insert(verificationLogsTable).values({
        engineerId: eng.id,
        attestatNumber: registryNumber,
        result: "fail",
        failureReason: reason,
        rawSnapshot: JSON.stringify(record),
      });
      res.status(400).json({
        isValid: false,
        engineerName: record.engineerName,
        message: `Верификация невозможна: членство в СРО «${record.sroName}» не является действующим. Ответственность инженера должна быть обеспечена компенсационным фондом действующей СРО.`,
      });
      return;
    }

    const worksCount = record.worksCount;
    const rejectionRate = worksCount > 0 ? record.rejectionsCount / worksCount : 0;
    const newRating = computeRatingFromRosreestr(record);

    await db.update(engineersTable).set({
      registryNumber,
      attestatNumber: registryNumber,
      isVerified: true,
      rosreestrStatus: record.status,
      sroName: record.sroName,
      sro: record.sroName,
      rosreestrCheckedAt: new Date(),
      rosreestrWorksCount: record.worksCount,
      rosreestrRejectionsCount: record.rejectionsCount,
      rosreestrSuspensionsCount: record.suspensionsCount,
      rosreestrRejectionRate: Math.round(rejectionRate * 1000) / 1000,
      rating: newRating,
    }).where(eq(engineersTable.id, eng.id));

    await db.insert(verificationLogsTable).values({
      engineerId: eng.id,
      attestatNumber: registryNumber,
      result: "pass",
      failureReason: null,
      rawSnapshot: JSON.stringify(record),
    });

    res.json({
      isValid: true,
      engineerName: record.engineerName,
      message: `Верификация пройдена. Инженер ${record.engineerName} найден в реестре Росреестра. СРО: ${record.sroName}.`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/engineers/:engineerId", optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.engineerId as string);
    const [eng] = await db.select().from(engineersTable).where(eq(engineersTable.id, id)).limit(1);
    if (!eng) { res.status(404).json({ error: "Engineer not found" }); return; }

    // Hidden engineers are suppressed from public access; admins and the engineer themselves can still view
    const isAdmin = req.user?.role === "admin" || req.user?.role === "superadmin";
    const isOwner = req.user?.userId === eng.userId;
    if (eng.isHidden && !isAdmin && !isOwner) {
      res.status(404).json({ error: "Engineer not found" }); return;
    }

    const formatted = await formatEngineer(eng);

    let contactsUnlocked = false;
    const requestingUserId = req.user?.userId;

    if (requestingUserId) {
      if (eng.userId === requestingUserId) {
        contactsUnlocked = true;
      } else {
        const acceptedBids = await db
          .select({ bidId: bidsTable.id })
          .from(bidsTable)
          .innerJoin(ordersTable, eq(bidsTable.orderId, ordersTable.id))
          .where(
            and(
              eq(bidsTable.engineerId, eng.id),
              eq(bidsTable.status, "accepted"),
              eq(ordersTable.customerId, requestingUserId)
            )
          )
          .limit(1);
        if (acceptedBids.length > 0) contactsUnlocked = true;
      }
    }

    if (!contactsUnlocked) {
      const { phone: _ph, email: _em, telegram: _tg, whatsapp: _wa, ...userWithoutContacts } = formatted.user as {
        phone?: string | null; email?: string | null; telegram?: string | null; whatsapp?: string | null; [key: string]: unknown
      };
      res.json({
        ...formatted,
        user: { ...userWithoutContacts, phone: null, email: null, telegram: null, whatsapp: null },
        contactsLocked: true,
      });
      return;
    }

    res.json({ ...formatted, contactsLocked: false });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
